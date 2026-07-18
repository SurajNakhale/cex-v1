import express, { type NextFunction, type Request } from "express"
import { type Response } from "express";
import bcrypt from "bcrypt"
import jwt, { type JwtPayload } from "jsonwebtoken"
import { JWT_SECRET } from "../config";
import { symbolName, TypePredicateKind, type EnumType } from "typescript";
const app = express();
app.use(express.json());

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

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

type OrderType = {
  id: number,
  userId: number,
  side: string,
  symbol: string,
  price: number,
  qty: number,
  filledQty: number,
  status: OrderStatus,
  createdAt: number,
}
// --- Orders ---

    enum OrderStatus {
        OPEN,
        FILLED,
        PARTIALLY_FILLED,
        PARTIALLY_FILLED_CANCLED,
        CANCELLED
    }
const ORDERS: OrderType[]  = [

];

type fillsType = {
    id: number,
    buyerId: number,
    sellerId: number,
    buyerOrderId: number,
    sellerOrderId: number,
    price: number,
    qty: number,
    createdAt: number
}
const FILLS: fillsType[] = [];

type balances = {
    [userId: number]: {
        [currency: string] : {
            available: number,
            locked: number
        }
    } 
}
const BALANCES: balances = {
    // 4039402: {
    //     "INR": {
    //         available: 32232,
    //         locked: 421
    //     },
    //     "AXIS": {
    //         available: 233,
    //         locked: 23
    //     }
    // },
    // 323434: {
    //     "inr": {
    //         available: 2332,
    //         locked: 232
    //     },
    //     "dollar": {
    //         available: 2323,
    //         locked: 233
    //     }
    // }
}; // { 
// userId: { 
        // INR: {
        //      available, 
        //      locked
        // }, 
        // stock: {
        //      available, 
        //      locked
        // },
//  ... } }



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
app.post("/signup",async (req, res) => {
    const { username, password } = req.body;
    const randomId = getId();

  // 1. check username not taken
  const user = USERS.find(x => username === x.username);

  if(user){
    return res.status(401).json({
        message: "user already exists"
    })
  }
  // 2. hash password (bcrypt/argon2)
  const hashpass = await bcrypt.hash(password, 10);
  // 3. push to USERS
  USERS.push({ id: randomId , username, password: hashpass });

  // 4. init BALANCES[userId] with INR: { available: 0, locked: 0 }
  BALANCES[randomId] = {
        INR : {
            available: 0,
            locked: 0
        },  
        AXIS: { 
            available: 0, 
            locked: 0 
        },
        HDFC: { 
            available: 0, 
            locked: 0 },
        TATA: { 
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

function response(res: Response, msg: string){
    return res.json(msg);
}
function getId(){
    return Math.floor(Math.random() * 1000);
}

app.post("/order", (req, res) => {
  // body: { userId, side: "BUY"|"SELL", type: "LIMIT"|"MARKET", symbol, price?, qty }
  const { userId, side, type, symbol, price, qty } = req.body;
  const orderId = getId();

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
  if(!(userId in BALANCES)){
      return response(res, "user does not found");
  }

  if(side == "BUY"){

    const inrBalance = BALANCES[userId]!.INR;
    if (!inrBalance) {
        return response(res, "inr balance does not exists")
    }
    const totalInr = inrBalance?.available + inrBalance?.locked;

    const orderValue = price*qty;
    if (inrBalance.available < orderValue) {
        return res.json({
            message: "Insufficient balance"
        });
    }

    inrBalance.available -= orderValue;
    inrBalance.locked += orderValue;
  }

    if(side == "SELL"){
        const stockBalance = BALANCES[userId]![symbol];
        if(!stockBalance){
            return response(res, "stock does not exists");
        }

        if(stockBalance.available < qty){
            return response(res, "insuffecient stock");
        }

        stockBalance.available -= qty;
        stockBalance.locked += qty;
    }

    const incommingOrder: OrderType = {
    id: orderId,
    userId: userId,
    side: side,
    symbol: symbol,
    price: price,
    qty: qty,
    filledQty: 0,
    status: OrderStatus.OPEN,
    createdAt: Date.now()
  }

    ORDERS.push(incommingOrder)

    // 3. run matching engine against opposite side of ORDERBOOK
    const stockBook = ORDERBOOK[symbol];
    if(!stockBook) return;


    if(side == "BUY"){
        // not added multi price matching logic will do it in version 2
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
            if(!remainingInOrder) continue;
            const filled = Math.min(remainingInOrder, remainingQty);
            if(filled){
                
                FILLS.push({
                    id: getId(),
                    buyerId: userId,
                    sellerId: order.userId,
                    buyerOrderId: orderId,
                    sellerOrderId: order.orderId,
                    qty: filled,
                    price: min,
                    createdAt: Date.now()
                })
                

                incommingOrder.filledQty += filled;
                if(incommingOrder.qty > incommingOrder.filledQty){
                    incommingOrder.status = OrderStatus.PARTIALLY_FILLED;
                    
                }

                if(incommingOrder.qty == incommingOrder.filledQty){
                    incommingOrder.status = OrderStatus.FILLED
                }


                
                order.filledQty += filled;
                remainingQty -= filled;
                ask.totalQty -= filled;

                //  6. settle balances on each fill (move locked -> other asset's available)
                
                const buyerBalance = BALANCES[userId];
                const sellerBalance = BALANCES[order.userId];

                buyerBalance!.INR!.locked -= filled*min;
                buyerBalance![symbol]!.available += filled
                
                sellerBalance!.INR!.available += filled*min;
                sellerBalance![symbol]!.locked -= filled;
                    
                }

            if(remainingQty == 0){
                break;
            }

        }

            //keeps condition which is true if filledqty < qty keep else remove
            //remove completed sell orders

            ask.orders = ask.orders.filter( order => {
                return order.filledQty < order.qty;
            })
            
            if(ask.totalQty == 0){
                delete asks[min];
            }

            // if order does not get fully filled qty is remaining add it to the bids side
            if(remainingQty > 0){
                if(type == "LIMIT"){

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
                else{
                    //type == MARKET
                    if(incommingOrder.filledQty == 0){
                        incommingOrder.status = OrderStatus.CANCELLED 
                    }
                    else if(incommingOrder.filledQty == qty){
                        incommingOrder.status = OrderStatus.FILLED
                    }
                    else{

                        incommingOrder.status  = OrderStatus.PARTIALLY_FILLED_CANCLED
                    }
                }
            }
        }
        else{
            //push buy order in bid side in orderbook
            // no bids match
            if(type == "LIMIT"){
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
            else{
                //type == market
                incommingOrder.status = OrderStatus.CANCELLED
            }
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

       // For a SELL order, match against the highest bid first.
        // A trade can happen if the buyer's bid price is
        // greater than or equal to the seller's limit price.
        if(maxbid >= price){
            const bid = bids[maxbid];
            if(!bid) return;

            
            let remainingQty = qty;

            for(let order of bid.orders){

                const remainingInOrder = order.qty - order.filledQty;
                const filled = Math.min(remainingInOrder, remainingQty);

                if(filled){

                    FILLS.push({
                        id: getId(),
                        sellerId: userId,
                        buyerId: order.userId,
                        sellerOrderId: orderId,
                        buyerOrderId: order.orderId,
                        qty: filled,
                        price: maxbid,
                        createdAt: Date.now()
                    })

                    incommingOrder.filledQty += filled;
                    if(incommingOrder.filledQty < incommingOrder.qty){
                        incommingOrder.status = OrderStatus.PARTIALLY_FILLED;
                    }
                    if(incommingOrder.qty == incommingOrder.filledQty){
                        incommingOrder.status = OrderStatus.FILLED;
                    }

                    order.filledQty += filled;
                    remainingQty -= filled;
                    bid.totalQty -= filled;
    
                    //settelment id side = sell;
                    const sellerBalance = BALANCES[userId];
                    const buyerBalance = BALANCES[order.userId];

                    sellerBalance!.INR!.available += filled*maxbid;
                    sellerBalance![symbol]!.locked -= filled

                    buyerBalance!.INR!.locked -= filled*maxbid;
                    buyerBalance![symbol]!.available += filled


                    if(remainingQty == 0){
                        break;
                    }
                }
                
            }

            bid.orders = bid.orders.filter(order => {
                return order.filledQty < order.qty;
            })

            if(remainingQty > 0){
                if(type == "LIMIT"){

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
                // type == market order
                else{
                    if(incommingOrder.filledQty == 0){
                        incommingOrder.status = OrderStatus.CANCELLED 
                    }
                    else if(incommingOrder.filledQty == qty){
                        incommingOrder.status = OrderStatus.FILLED
                    }
                    else{

                        incommingOrder.status  = OrderStatus.PARTIALLY_FILLED_CANCLED
                    }
                }

            }

            if(bid.totalQty == 0){
                delete bids[maxbid];
            }
        }
        else{
            if(type == "LIMIT"){

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
            else{
                //type == market
                incommingOrder.status = OrderStatus.CANCELLED
            
            }
        }
    }

    // done 4. write fills to FILLS, update filledQty + status on ORDERS
    
    // done 5. if leftover qty and LIMIT, rest on book; if MARKET, cancel remainder
    //  6. settle balances on each fill (move locked -> other asset's available)
});
const authMiddleware = (req:Request, res:Response, next:NextFunction) => {
    const headers = req.headers.authorization;
    const token = headers?.split(" ")[1];

    if(!token) return;

    const decoded = jwt.verify(token, JWT_SECRET) as {userId: string};
    req.userId = Number(decoded.userId);

    next();
}
app.delete("/order/:orderId", authMiddleware, (req, res) => {
  // 1. find order, check ownership
    const userId = req.userId;
    const orderId = Number(req.params.orderId);
    const order = ORDERS.find(x => x.id == orderId);
    if(!order) response(res, "order does not exists");
    
    if(order?.userId != userId){
        return response(res, "invalid user")
    }


    if(order?.status == OrderStatus.PARTIALLY_FILLED && order.side == "BUY"){
        // 2. remove from ORDERBOOK price level
        const bidSide = ORDERBOOK[order.symbol]!.bids;
        if(!bidSide) return;
        const price = order.price;
        bidSide[price]!.orders = bidSide[price]!.orders.filter(x => x.orderId != order.id); 

        if(bidSide[price]!.orders.length == 0){
            delete bidSide[price];
        }

        //unlock remaining reversed balance
        //we calculate because balances[userId] may include money locked for multiple orders.
        const lockedAmmount = (order.qty - order.filledQty) * order.price; 
        const buyerId = BALANCES[order.userId]!.INR
        
        buyerId!.available += lockedAmmount;
        buyerId!.locked -= lockedAmmount;
        

        //mark status = cancelled
        order.status = OrderStatus.PARTIALLY_FILLED_CANCLED;
    }
    else if(order?.status == OrderStatus.PARTIALLY_FILLED && order.side == "SELL"){
        const askSide = ORDERBOOK[order.symbol]!.asks;
        if(!askSide) return;
        const price = order.price;
        askSide[price]!.orders = askSide[price]!.orders.filter(x => x.orderId != order.id); 

        if(askSide[price]!.orders.length == 0){
            delete askSide[price];
        }
        // 3. unlock remaining reserved balance
        const lockedAmmount = (order.qty - order.filledQty); 
        const sellerId = BALANCES[order.userId]![order.symbol];
        
        sellerId!.available += lockedAmmount;
        sellerId!.locked -= lockedAmmount;
        


        // 4. mark status = CANCELLED
        order.status = OrderStatus.PARTIALLY_FILLED_CANCLED;

    }

    return response(res, "order cancelled successfully")
});

app.get("/orders", (req, res) => {
  // query: ?status=OPEN  (or all)
  const statusParam = req.query.status;

  //@ts-ignore
  const orders = ORDERS.filter(order => order.status === statusParam);

  // return current user's orders
  res.json(orders);
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
  const headers = req.headers.authorization;
  const token = headers?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "missing token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload | string;
    if (typeof decoded === "string" || typeof decoded.userId !== "number") {
        return res.status(401).json({ message: "invalid token" });
    }

    req.userId = decoded.userId;
    return res.json(BALANCES[req.userId] ?? {});
});

app.listen(3000, () => console.log("CEX running on :3000"));