CREATE TABLE book_checkout_orders (
 id TEXT PRIMARY KEY,
 book_id TEXT NOT NULL,
 session_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX book_checkout_orders_created ON book_checkout_orders(session_id,created_at);
--> statement-breakpoint
CREATE TABLE book_payment_allocations (
 transaction_id TEXT PRIMARY KEY,
 book_id TEXT NOT NULL,
 order_id TEXT UNIQUE REFERENCES book_checkout_orders(id),
 paid_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
