import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "./config";
import { TypePredicateKind } from "typescript";
const app = express();
app.use(express.json());


type user = {
    id: number
    username: string
    password: string
}
// --- In-memory state ---
const USERS: user[] = [];

const STOCKS = [
  { id: 1, title: "AXIS BANK", symbol: "AXIS" },
  { id: 2, title: "HDFC BANK", symbol: "HDFC" },
  { id: 3, title: "TATA Steel", symbol: "TATA" },
];
const ORDERS = [];

const FILLS = [];

type balType = {
    available: number
    locked: number 
}

type userBal = {
    [currency: string]: balType
}

type balances = {
    [userId: number]: userBal 
}
const BALANCES: balances = {}; // { userId: { INR: {available, locked}, AXIS: {available, locked}, ... } }

type orderType = {
    userId: number,
    qty: number,
    filledQty: number,
    orderId: number,
    createdAt: number
}
type orderbook = {
    [symbol: string]: {
        [side: string]: {
            [price: number]: {
                totalQty: number,
                orders: orderType[]
            }
        }
    }
}
const ORDERBOOK: orderbook = {
  AXIS: { 
    bids: {
        299: {
            totalQty: 20,
            orders: [{ 
                userId: 1,
                qty: 10,
                filledQty: 3,
                orderId: 1,
                createdAt: Date.now()
            },{
                userId: 2, 
                qty: 10,
                filledQty: 4,
                orderId: 2,
                createdAt: Date.now()
            }]
        }
  }, 
  asks: {

  } },
  HDFC: { bids: {}, asks: {} },
  TATA: { bids: {}, asks: {} },
};

// --- Auth ---
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
    const randomId = Math.floor(Math.random() * 100);

  // 1. check username not taken
  const user = USERS.find(x => username === x.username);

  if(user){
    return res.status(401).json({
        message: "user already exists"
    })
  }
  // 2. hash password (bcrypt/argon2)
  const hashpass = bcrypt.hash(password, 10);
  // 3. push to USERS
  USERS.push({ id: randomId , username, password });

  // 4. init BALANCES[userId] with INR: { available: 0, locked: 0 }
  BALANCES[randomId] = {
        INR : {
        available: 0,
        locked: 0
    }
  }
});

app.post("/login", (req, res) => {
  // 1. find user by username
    const {username, password } = req.body;
    const user = USERS.find(x => username === x.username);
    if(!user){
        return res.json({
            message: "user does not exists"
        })
    }
  // 2. compare hashed password
  const isMatch = bcrypt.compare(password, user.password);
  if(!isMatch){
    return res.json({
        message: "invalid credentails"
    })
  }
  // 3. return JWT / session token
  const token = jwt.sign({
    userId: user.id
  }, JWT_SECRET)

  res.status(200).json({
    message: "login successfull",
    token
  })
});

// --- Orders ---
app.post("/order", (req, res) => {
  // body: { userId, side: "BUY"|"SELL", type: "LIMIT"|"MARKET", symbol, price?, qty }

  const { userId, side, type, symbol, price, qty } = req.body;
  const orderId = Math.floor(Math.random() * 1000)
  // 1. validate input + stock exists
  const user = USERS.find(x => userId == x.id);
  if(!user){
    return
  }

  const stockExists = STOCKS.find(x => symbol == x.symbol);
  if(!stockExists){
    return
  }


  // 2. check + lock balance (INR for BUY, stock for SELL)
const userBalance = BALANCES[userId];

if(userBalance == undefined){
    return
}

const inrBalance = userBalance.INR;

if (!inrBalance) {
    return res.json({
        message: "INR wallet missing"
    });
}
const orderValue = price*qty;

if (inrBalance.available < orderValue) {
    return res.json({
        message: "Insufficient balance"
    });
}

inrBalance.available -= orderValue;
inrBalance.locked += orderValue;

  // 3. run matching engine against opposite side of ORDERBOOK
  const stockBook = ORDERBOOK[symbol];
  if(!stockBook) return;


if(side == "BUY"){

    const asks = stockBook.asks
    if(!asks) return;

    //find the minimus price
    const prices = Object.keys(asks);
    if(prices.length == 0) return;
    let min = Number(prices[0]);
    for(let i=1; i<prices.length; i++){
        let currentPrice = Number(prices[i]);
        if(currentPrice < min){
            min = currentPrice;
        }
    }

    //check if prices is >= min execute the matching logic
    if(price >= min){
       //order matching logic   
       let ask = asks[min];
       if(!ask) return;
       
       //orderbook has
       /*
       ask
       300: {
        totalQty: 25,
        orders: [
            { userId: 4, qty: 10, filledQty: 7, orderId: 4, createdAt: Date.now() },
            { userId: 5, qty: 15, filledQty: 0, orderId: 5, createdAt: Date.now() }
        ]
      },
      
      buy 10 at 300
      
      //price, qty, totalqty
      */
     
     let remainingQty = qty;
     
     for(let order of ask.orders){
         const remainingInOrder = order.qty - order.filledQty;
         const filled = Math.min(remainingInOrder, remainingQty);
         
         order.filledQty += filled;
         
         remainingQty -= filled;
         
         ask.totalQty -= filled;
         
         if(remainingQty == 0){
             break;
            }
        }

        //keeps condition which is true if filledqty < qty keep else remove
        ask.orders = ask.orders.filter( order => {
            return order.filledQty < order.qty;
        })
        
        if(ask.totalQty == 0){
            delete asks[min];
        }

        // if order does not get fully filled qty is remaining add it to the bids side
        if(remainingQty > 0){
            if(!stockBook.bids) return;
            //for this price if it does not exists in bids side first create the price object
            if(!stockBook.bids[price]){
                stockBook.bids[price] = {
                    totalQty: 0,
                    orders: []
                }
            }

            //for this price if already bid exist add qty and push orders
            stockBook.bids[price].totalQty += remainingQty;

            stockBook.bids[price].orders.push({
                userId,
                qty: remainingQty,
                filledQty: 0,
                orderId,
                createdAt: Date.now()
            })
        }

    }
    else{
        //push bid order in orderbook
        // no match bids
        if(!stockBook.bids) return;
        if(!stockBook.bids[price]){
            stockBook.bids[price] = {
                totalQty: 0,
                orders: []
            }
        }

        stockBook.bids[price].totalQty += qty;

        stockBook.bids[price].orders.push({
            userId,
            qty,
            filledQty: 0,
            orderId,
            createdAt: Date.now()
        })
    } 
}
else{
    // for sell  side
    const bids = stockBook.bids;
    if(!bids) return;

    const prices = Object.keys(bids);
    if(prices.length == 0) return;
    let maxbid = Number(prices[0]);

    for(let i=1; i<prices.length; i++){
        const currentPrice = Number(prices[i]);
        if(currentPrice > maxbid){
            maxbid = currentPrice;
        }
    }

    //whenever we are sell we see highest bidprice,
    //if anyonewant to buy at higher price so that why bidprice >= sellprice
    if(maxbid >= price){
        const bid = bids[maxbid];
        if(!bid) return;

        
        let remainingQty = qty;

        for(let order of bid.orders){

            const remainingInOrder = order.qty - order.filledQty;
            const filled = Math.min(remainingInOrder, remainingQty);

            order.filledQty += filled;

            remainingQty -= filled;

            bid.totalQty -= filled;


            if(remainingQty == 0){
                break;
            }
        }

        bid.orders = bid.orders.filter(order => {
            return order.filledQty < order.qty;
        })

        if(remainingQty > 0){
            if(!stockBook.asks) return;
            if(!stockBook.asks[price]){
                stockBook.asks[price] = {
                    totalQty: 0,
                    orders: []
                }
            }

            stockBook.asks[price].totalQty += remainingQty;
            stockBook.asks[price].orders.push({
                userId,
                qty: remainingQty,
                filledQty: 0,
                orderId,
                createdAt: Date.now()
            })
        }

        if(bid.totalQty == 0){
            delete bids[maxbid];
        }
    }
    else{
        if(!stockBook.asks) return;
            if(!stockBook.asks[price]){
                stockBook.asks[price] = {
                    totalQty: 0,
                    orders: []
                }
            }

            stockBook.asks[price].totalQty += qty;
            stockBook.asks[price].orders.push({
                userId,
                qty,
                filledQty: 0,
                orderId,
                createdAt: Date.now()
            })
    }


    
}

// 4. write fills to FILLS, update filledQty + status on ORDERS
  // 5. if leftover qty and LIMIT, rest on book; if MARKET, cancel remainder
  // 6. settle balances on each fill (move locked -> other asset's available)
});

app.delete("/order/:orderId", (req, res) => {
  // 1. find order, check ownership
  // 2. remove from ORDERBOOK price level
  // 3. unlock remaining reserved balance
  // 4. mark status = CANCELLED
});

app.get("/orders", (req, res) => {
  // query: ?status=OPEN  (or all)
  // return current user's orders
});

// --- Market data ---
app.get("/orderbook/:symbol", (req, res) => {
  // return aggregated depth — totalQty per price level for bids and asks
  // (don't expose individual userIds to other users)
});

app.get("/fills/:symbol", (req, res) => {
  // recent trades for this stock — the "tape"
});

app.get("/stocks", (req, res) => {
  res.json(STOCKS);
});

// --- User data ---
app.get("/balance", (req, res) => {
  // return BALANCES[userId] for the authed user
});

app.listen(3000, () => console.log("CEX running on :3000"));