
# Mini Centralized Exchange (CEX -v1)

## Overview

A simplified implementation of a Centralized Exchange (CEX) backend built using Node.js, Express, and TypeScript.

The goal of this project is to understand how trading engines work internally by implementing the core components of a stock exchange from scratch.

---

# Tech Stack

- Node.js
- Express.js
- TypeScript
- JWT Authentication
- Bcrypt
- In-memory Data Structures

---

# Features

## Authentication

- User Signup
- User Login
- JWT Authentication
- Password Hashing

---

## Wallet Management

Supports

- INR
- AXIS
- HDFC
- TATA

Each balance tracks

- Available Balance
- Locked Balance

---

## Order Types

- BUY LIMIT
- SELL LIMIT
- BUY MARKET
- SELL MARKET

---

## Matching Engine

Supports

- Price-Time Priority
- Full Fills
- Partial Fills
- Order Book Updates
- Trade Settlement

---

## Order Cancellation

Supports cancellation of partially filled orders while correctly unlocking only the remaining reserved balances.

---

## Market Data

Implemented APIs

- Order Book
- Recent Trades (Fills)
- Stocks
- User Balances

---

# System Architecture

```
Client
    │
Express API
    │
──────────────────────────────────
Authentication
Wallet
Matching Engine
Settlement
Market Data
──────────────────────────────────
    │
In-Memory State
```

---

# Data Structures

## USERS

Stores registered users.

---

## BALANCES

Stores

- INR
- Stocks

Each asset maintains

```
available
locked
```

---

## ORDERS

Stores every submitted order.

Tracks

- Quantity
- Filled Quantity
- Status
- Price
- Symbol

---

## ORDERBOOK

Stores active orders.

```
Symbol

    bids

        price

            totalQty
            orders[]

    asks

        price

            totalQty
            orders[]
```

---

## FILLS

Stores executed trades.

Contains

- Buyer
- Seller
- Price
- Quantity
- Timestamp

---

# API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /signup | Register User |
| POST | /login | Login |
| POST | /order | Place Order |
| DELETE | /order/:id | Cancel Order |
| GET | /orders | User Orders |
| GET | /orderbook/:symbol | Aggregated Market Depth |
| GET | /fills/:symbol | Recent Trades |
| GET | /stocks | Stocks |
| GET | /balance | User Balances |

---

# Matching Flow

```
Receive Order

↓

Validate

↓

Lock Balance

↓

Match Against Opposite Side

↓

Generate Trade

↓

Settlement

↓

Update Order Book

↓

Return Response
```

---

# Concepts Covered

- Authentication
- JWT
- Password Hashing
- Order Matching
- Partial Fills
- Full Fills
- Balance Locking
- Settlement
- Market Orders
- Limit Orders
- Order Book
- Trade Tape
- Order Cancellation
- Market Data APIs

---

# Future Improvements

- Multi-price Matching
- PostgreSQL
- Redis
- WebSockets
- Docker
- Rate Limiting
- Zod Validation
- Unit Testing
- Integration Testing
- Production-grade Matching Engine

---

# Project Status

Version 1

Implemented

- Authentication
- Wallet Management
- Matching Engine
- Settlement
- Order Cancellation
- Order Book API
- Fills API
- Market Data APIs

Next Version

- Multi-price Matching
- Real-time Order Book
- Persistent Storage
- WebSocket Streaming

---


```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
