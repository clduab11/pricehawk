# Data Schema

## Overview

This document defines the JSON schemas used throughout the Pricing Error Alert Service for products, anomalies, and notifications.

## Product Schema

The core product schema used for scraped data and anomaly detection.

```typescript
interface Product {
  /** Unique identifier for the product */
  id: string;
  
  /** Product name/title from the retailer */
  product_name: string;
  
  /** Current listed price in USD */
  current_price: number;
  
  /** Original/MSRP price in USD (if available) */
  original_price: number | null;
  
  /** Stock availability status */
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  
  /** Retailer identifier (e.g., 'amazon', 'walmart', 'target') */
  retailer_id: string;
  
  /** ISO 8601 timestamp of last price check */
  last_checked: string;
  
  /** Product URL on retailer site */
  url: string;
  
  /** Product image URL (optional) */
  image_url?: string;
  
  /** Product category */
  category?: string;
  
  /** SKU or product identifier from retailer */
  retailer_sku?: string;
}
```

### JSON Example

```json
{
  "id": "prod_abc123",
  "product_name": "Sony WH-1000XM5 Wireless Headphones",
  "current_price": 19.99,
  "original_price": 399.99,
  "stock_status": "in_stock",
  "retailer_id": "amazon",
  "last_checked": "2024-01-15T14:30:00Z",
  "url": "https://amazon.com/dp/B09XS7JWHH",
  "image_url": "https://m.media-amazon.com/images/I/headphones.jpg",
  "category": "Electronics",
  "retailer_sku": "B09XS7JWHH"
}
```

## Pricing Anomaly Schema

Schema for detected pricing anomalies before AI validation.

```typescript
interface PricingAnomaly {
  /** Unique anomaly identifier */
  id: string;
  
  /** Reference to the product */
  product_id: string;
  
  /** Embedded product data at time of detection */
  product: Product;
  
  /** Type of anomaly detected */
  anomaly_type: 'z_score' | 'percentage_drop' | 'decimal_error' | 'historical';
  
  /** Z-score value (for z_score type) */
  z_score?: number;
  
  /** Percentage price drop from original */
  discount_percentage: number;
  
  /** Initial confidence score (0-100) */
  initial_confidence: number;
  
  /** ISO 8601 timestamp of detection */
  detected_at: string;
  
  /** Status in the pipeline */
  status: 'pending' | 'validated' | 'rejected' | 'notified';
}
```

### JSON Example

```json
{
  "id": "anomaly_xyz789",
  "product_id": "prod_abc123",
  "product": {
    "id": "prod_abc123",
    "product_name": "Sony WH-1000XM5 Wireless Headphones",
    "current_price": 19.99,
    "original_price": 399.99,
    "stock_status": "in_stock",
    "retailer_id": "amazon",
    "last_checked": "2024-01-15T14:30:00Z",
    "url": "https://amazon.com/dp/B09XS7JWHH"
  },
  "anomaly_type": "z_score",
  "z_score": 4.2,
  "discount_percentage": 95.0,
  "initial_confidence": 85,
  "detected_at": "2024-01-15T14:30:05Z",
  "status": "pending"
}
```

## Validated Glitch Schema

Schema for AI-validated pricing glitches.

```typescript
interface ValidatedGlitch {
  /** Unique glitch identifier */
  id: string;
  
  /** Reference to the anomaly */
  anomaly_id: string;
  
  /** Embedded product data */
  product: Product;
  
  /** AI validation result */
  validation: {
    /** Whether AI confirms this is a glitch */
    is_glitch: boolean;
    
    /** AI confidence score (0-100) */
    confidence: number;
    
    /** AI's reasoning for the decision */
    reasoning: string;
    
    /** Suggested glitch type */
    glitch_type: 'decimal_error' | 'database_error' | 'clearance' | 'coupon_stack' | 'unknown';
  };
  
  /** Potential profit margin percentage */
  profit_margin: number;
  
  /** Estimated time until correction */
  estimated_duration?: string;
  
  /** ISO 8601 timestamp of validation */
  validated_at: string;
}
```

### JSON Example

```json
{
  "id": "glitch_def456",
  "anomaly_id": "anomaly_xyz789",
  "product": {
    "id": "prod_abc123",
    "product_name": "Sony WH-1000XM5 Wireless Headphones",
    "current_price": 19.99,
    "original_price": 399.99,
    "stock_status": "in_stock",
    "retailer_id": "amazon",
    "last_checked": "2024-01-15T14:30:00Z",
    "url": "https://amazon.com/dp/B09XS7JWHH"
  },
  "validation": {
    "is_glitch": true,
    "confidence": 95,
    "reasoning": "Price is 95% below MSRP with Z-score of 4.2. This appears to be a decimal point error ($199.99 → $19.99).",
    "glitch_type": "decimal_error"
  },
  "profit_margin": 95.0,
  "estimated_duration": "30 minutes",
  "validated_at": "2024-01-15T14:30:10Z"
}
```

## Notification Schema

Schema for notification payloads sent to subscribers.

```typescript
interface Notification {
  /** Unique notification identifier */
  id: string;
  
  /** Reference to the validated glitch */
  glitch_id: string;
  
  /** Target channel */
  channel: 'facebook' | 'discord' | 'sms';
  
  /** Formatted message content */
  message: {
    /** Headline/title */
    title: string;
    
    /** Main message body */
    body: string;
    
    /** Product image URL */
    image_url?: string;
    
    /** Affiliate/tracking link */
    link: string;
    
    /** Price comparison */
    pricing: {
      current: number;
      original: number;
      savings: number;
      discount_percent: number;
    };
  };
  
  /** Delivery status */
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  
  /** ISO 8601 timestamp of creation */
  created_at: string;
  
  /** ISO 8601 timestamp of delivery (if sent) */
  delivered_at?: string;
}
```

### JSON Example

```json
{
  "id": "notif_ghi012",
  "glitch_id": "glitch_def456",
  "channel": "facebook",
  "message": {
    "title": "🚨 95% OFF! Sony WH-1000XM5 Headphones",
    "body": "PRICING ERROR DETECTED! Sony WH-1000XM5 Wireless Headphones normally $399.99 now just $19.99! Act fast before it's fixed!",
    "image_url": "https://m.media-amazon.com/images/I/headphones.jpg",
    "link": "https://amazon.com/dp/B09XS7JWHH?tag=youraffid",
    "pricing": {
      "current": 19.99,
      "original": 399.99,
      "savings": 380.00,
      "discount_percent": 95.0
    }
  },
  "status": "delivered",
  "created_at": "2024-01-15T14:30:15Z",
  "delivered_at": "2024-01-15T14:30:18Z"
}
```

## Database Tables (Supabase)

### products
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| product_name | text | Product name |
| current_price | decimal | Current price |
| original_price | decimal | Original price |
| stock_status | text | Stock status enum |
| retailer_id | text | Retailer identifier |
| url | text | Product URL |
| image_url | text | Image URL |
| category | text | Category |
| retailer_sku | text | Retailer SKU |
| last_checked | timestamptz | Last check timestamp |
| created_at | timestamptz | Creation timestamp |

### price_history
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| product_id | uuid | Foreign key to products |
| product_url | text | Product URL (indexed for lookups) |
| price | decimal | Price at time of check |
| checked_at | timestamptz | Check timestamp |

### anomalies
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| product_id | uuid | Foreign key to products |
| anomaly_type | text | Type of anomaly |
| z_score | decimal | Z-score value |
| discount_percentage | decimal | Discount percentage |
| initial_confidence | integer | Initial confidence (0-100) |
| status | text | Pipeline status |
| detected_at | timestamptz | Detection timestamp |

### validated_glitches
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| anomaly_id | uuid | Foreign key to anomalies |
| is_glitch | boolean | AI validation result |
| confidence | integer | AI confidence (0-100) |
| reasoning | text | AI reasoning |
| glitch_type | text | Type of glitch |
| profit_margin | decimal | Profit margin percentage |
| validated_at | timestamptz | Validation timestamp |

### notifications
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| glitch_id | uuid | Foreign key to validated_glitches |
| channel | text | Notification channel |
| message | jsonb | Message content |
| status | text | Delivery status |
| created_at | timestamptz | Creation timestamp |
| delivered_at | timestamptz | Delivery timestamp |
