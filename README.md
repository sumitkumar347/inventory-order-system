# Quantiv — Inventory & Order Management System

Quantiv is a high-precision, role-based inventory and order management system built using **Next.js**, **Neon-hosted PostgreSQL**, and **Prisma ORM**, styled with standard **Vanilla CSS** for a premium glassmorphic dark-theme user experience.

---

## 🌟 Key Features

1. **Role-Based Authentication**:
   - **Admin**: Create, edit, and soft-delete products. Monitor inventory levels (with visual health indicators). View incoming orders and verify precise unit conversions. Approve or reject orders.
   - **Seller/User**: Browse, search, and filter products by name, SKU, or category. Add products to a reactive cart. Input order quantities in any compatible unit and see live price calculations. Place order requests.
2. **Flexible Unit Conversions**:
   - Supports 5 primary units spanning 3 dimensions: Weight (`g`, `kg`), Volume (`mL`, `L`), and Count (`item`).
   - Translates quantities entered in non-base units (e.g. ordering `500 g` for a product stored in `kg`) instantly on the frontend, and records conversion audit logs in the database.
3. **High Decimal Precision & Transaction Security**:
   - Protects numeric parameters with PostgreSQL `numeric(20,4)` (prices/quantities) and `numeric(20,8)` (conversion factors) types, safeguarding against floating-point errors.
   - Uses atomic database transactions to ensure stock deduction is thread-safe and prevents overselling.
   - Restores reserved inventory automatically if an admin rejects a pending quotation.

---

## 🛠 Tech Stack & High-Level System Design

```
+-------------------------------------------------------+
|                       FRONTEND                        |
|   Next.js (App Router, Client Components, React 19)   |
|   Vanilla CSS Module + Glassmorphic Design Variables   |
+---------------------------+---------------------------+
                            | (JSON/Form Action Protocol)
                            v
+-------------------------------------------------------+
|                       BACKEND                         |
|   Next.js Server Actions (Secure Server RPC Handlers)  |
|   jose (JWT Cookies) & Next.js Routing Middleware     |
+---------------------------+---------------------------+
                            | (Prisma client protocol)
                            v
+-------------------------------------------------------+
|                       DATABASE                        |
|   Neon Serverless PostgreSQL Instance                 |
|   Prisma ORM (Schema migrations & client gen)        |
+-------------------------------------------------------+
```

### Interactions:
- **Middleware Protection**: Before page rendering, Next.js Middleware checks the `session_token` cookie (signed JWT using `jose`). If valid, it attaches user claims to request headers; if invalid or expired, it redirects to `/login`.
- **Server Actions**: Instead of standard REST boilerplate, Server Actions act as secure RPC handlers. They fetch data, write to the database, and read/delete cookie sessions directly on the server.
- **Neon Cloud DB**: Hosted on Neon PostgreSQL. Connections are established serverless-side via connection pooling.

---

## 💾 Database Schema & Numeric Precision Decisions

### Choice of PostgreSQL Types
- **Money & Pricing**: `numeric(20, 4)`. Storing rates with 4 decimal places ensures we can represent small fractional values (e.g. ₹0.076 per milliliter, which rounds up to ₹76 per liter) without accumulating truncation errors.
- **Quantities**: `numeric(20, 4)`. Handles fractional weights or volumes (e.g. `0.0005 kg`).
- **Conversion Factors**: `numeric(20, 8)`. Up to 8 decimal places to handle high-ratio division scaling (e.g., `0.001` or division quotients) with maximum fidelity.

### Key Database Tables (Prisma Notation)

#### 1. `User`
Tracks credentials and system roles.
- `id` (String/UUID): Primary Key
- `email` (String): Unique email login
- `passwordHash` (String): Bcrypt-hashed password
- `role` (Enum): `ADMIN` | `SELLER`
- `createdAt` / `updatedAt` (DateTime)

#### 2. `Product`
Stores product catalog metadata and current stock levels.
- `id` (String/UUID): Primary Key
- `name` (String): Product title
- `sku` (String): Unique inventory SKU code
- `category` (String): Group categorization
- `baseUnit` (String): Storage unit (`g`, `kg`, `L`, `mL`, `item`)
- `basePrice` (Decimal, 20,4): Price in INR per single `baseUnit`
- `stockQuantity` (Decimal, 20,4): Stock volume in terms of `baseUnit`
- `status` (String): `'active'` | `'inactive'` (for soft-deletes)

#### 3. `Order`
Represents customer quotations/orders.
- `id` (String/UUID): Primary Key
- `userId` (String): Foreign Key to `User`
- `totalAmount` (Decimal, 20,4): Calculated order total in INR
- `status` (Enum): `PENDING` | `APPROVED` | `REJECTED`
- `createdAt` / `updatedAt` (DateTime)

#### 4. `OrderItem`
Maintains individual items purchased and records the exact conversions applied at order time.
- `id` (String/UUID): Primary Key
- `orderId` (String): Foreign Key to `Order` (on cascade delete)
- `productId` (String): Foreign Key to `Product`
- `orderedQuantity` (Decimal, 20,4): Quantity requested in `orderedUnit`
- `orderedUnit` (String): Unit selected during ordering (`g`, `kg`, `L`, `mL`, `item`)
- `conversionFactor` (Decimal, 20,8): Multiplier factor to convert ordered unit to base unit
- `unitPrice` (Decimal, 20,4): Historical base unit price at order time in INR
- `calculatedPrice` (Decimal, 20,4): Item line total (`baseQuantity * unitPrice`) in INR

---

## 🔄 Unit Storage & Conversion Strategy

Quantiv implements a **Unified Dimension Class** strategy.

### Dimension Groups
Units belong to one of three dimension groups. Conversions are only permitted within the same group:
1. **Weight**: `kg` (kilograms), `g` (grams) — Relation: `1 kg = 1000 g`
2. **Volume**: `L` (liters), `mL` (milliliters) — Relation: `1 L = 1000 mL`
3. **Count**: `item` (units) — Relation: `1 item = 1 item`

### Conversion Multipliers
To normalize any ordered quantity into the product's internal `baseUnit` quantity, we multiply by the `conversionFactor`:
$$\text{Base Quantity} = \text{Ordered Quantity} \times \text{Conversion Factor}$$

| Base Unit (`Product.baseUnit`) | Ordered Unit (`OrderItem.orderedUnit`) | Conversion Factor (`OrderItem.conversionFactor`) |
|---|---|---|
| `g` | `g` | `1.0` |
| `g` | `kg` | `1000.0` (1 kg = 1000 g) |
| `kg` | `g` | `0.001` (1 g = 0.001 kg) |
| `kg` | `kg` | `1.0` |
| `mL` | `mL` | `1.0` |
| `mL` | `L` | `1000.0` (1 L = 1000 mL) |
| `L` | `mL` | `0.001` (1 mL = 0.001 L) |
| `L` | `L` | `1.0` |
| `item` | `item` | `1.0` |

### Conversion Execution
1. **Frontend (Real-time Preview)**: When a seller alters quantities or units in the cart, the client script loads `utils/conversions.ts` using `Decimal.js` to calculate and display the total price and base quantity conversions dynamically.
2. **Backend (Order Placement)**: When submitting the order, the system retrieves the product details, computes the `conversionFactor`, validates that the requested quantity is smaller than or equal to the available stock, deducts inventory, and records all historical rate logs inside `OrderItem`.
3. **Audit Trail (Admin Dashboard)**: The Admin console retrieves these details and explicitly lays them out (e.g. showing `Ordered: 500 g -> Scale audit: 500 * 0.001 = 0.5000 kg -> Price audit: 0.5000 kg @ ₹80.0000 = ₹40.00`), creating an error-free, verifiable audit trail.

---

## ⚙️ Local Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- A Neon PostgreSQL Database Instance (or any PostgreSQL instance)

### Setup Steps
1. **Clone/Navigate** to the project folder:
   ```bash
   cd E:\inventory-order-system
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Set up Environment Variables**:
   Create a `.env` file at the root of the project (copying from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your actual **Neon PostgreSQL Connection String**:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require"
   JWT_SECRET="generate_a_random_32_character_hash"
   ```
4. **Push Schema and Generate Prisma Client**:
   This command automatically deploys the schema models directly to your Neon database instance:
   ```bash
   npx prisma db push
   ```
5. **Seed the Database**:
   Populates your database with test credentials and starting products:
   ```bash
   npx prisma db seed
   ```
6. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser to [http://localhost:3000](http://localhost:3000).

---

## 🚀 Deployment to Vercel

To deploy or redeploy the application on Vercel:

1. **Prerequisites**: Ensure you have installed the Vercel CLI (`npm install -g vercel`) and logged in (`vercel login`).
2. **Configure project details**:
   Run the deployment command:
   ```bash
   vercel
   ```
   Select your Vercel workspace, link to a new project named `quantiv-inventory`, and configure default options.
3. **Set Environment Variables on Vercel**:
   Add the following environment variables in the Vercel project settings console (under Settings -> Environment Variables) or via CLI:
   - `DATABASE_URL` (your Neon connection string)
   - `JWT_SECRET` (your JWT signing secret)
4. **Production Build & Deploy**:
   Once environment variables are added, push a production deployment:
   ```bash
   vercel --prod
   ```
   Vercel will build the Next.js routes, execute standard compilation checks, and provide your live URL.

---

## 🔑 Test Login Credentials & Panels Usage Guide

### Test Credentials
| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@inventory.com` | `admin123` |
| **Seller** | `seller@inventory.com` | `seller123` |

### Using the Panels

#### 1. Seller Portal
- **Browse / Search**: Search products in real-time or filter by category.
- **Create Quotation**: Click **Add to Order** on items. In the cart sheet on the right, input the quantity and change the dropdown unit. Watch the price recalculate automatically in INR.
- **Submit**: Click **Place Order / Quotation** to submit. It immediately deducts stock and reserves it.
- **Order History**: Click the **Order History** tab to view your past orders, date submitted, conversion breakdown, and pending/fulfillment status.

#### 2. Admin Console
- **Inventory Manager**:
  - Click **Add Product** to create a product. Pick a name, SKU, base unit, price (per base unit), and starting stock.
  - Click **Edit** to modify description, base price, or stock levels.
  - Click **Delete** to perform a soft-delete (removes from catalog but preserves order history).
  - Observe the stock indicators ("Healthy", "Moderate", "Critical Low" badges) showing real-time inventory levels.
- **Manage Quotations**:
  - Displays a queue of incoming orders.
  - For each order, look at the **Detailed Conversions Audit** to inspect the math (e.g. converting `g` to `kg` at base rate and computing prices).
  - Click **Approve** to accept the order and complete fulfillment.
  - Click **Reject** to cancel the order. This triggers an automated inventory transaction that restores the reserved quantities back to the product's catalog stock levels.
