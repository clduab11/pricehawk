# Price Analysis Engine

## Overview

The price analysis engine processes scraped product data to identify genuine pricing errors, calculate profit margins, and filter out false positives.

## Detection Algorithms

### 1. Pricing Error Detection

```typescript
interface PriceAnalysis {
  isPricingError: boolean;
  confidence: number; // 0-100
  errorType: 'decimal' | 'percentage' | 'penny' | 'coupon_stack' | 'unknown';
  profitMargin: number;
  historicalAverage?: number;
  competitorPrices?: number[];
}

export class PriceAnalysisEngine {
  async analyzeProduct(product: Product): Promise<PriceAnalysis> {
    // Multi-factor analysis
    const analyses = await Promise.all([
      this.checkDecimalError(product),
      this.checkPercentageDiscount(product),
      this.checkHistoricalPricing(product),
      this.checkCompetitorPricing(product),
      this.checkCouponStacking(product),
    ]);

    // Combine signals
    return this.combineAnalyses(analyses);
  }

  private async checkDecimalError(
    product: Product
  ): Promise<Partial<PriceAnalysis>> {
    const { price, originalPrice, title } = product;

    // Check for misplaced decimal (e.g., $1.99 vs $199)
    if (originalPrice) {
      const ratio = price / originalPrice;
      
      if (ratio < 0.01 || ratio > 100) {
        // Likely decimal error
        return {
          isPricingError: true,
          confidence: 95,
          errorType: 'decimal',
          profitMargin: ((originalPrice - price) / price) * 100,
        };
      }
    }

    return { isPricingError: false, confidence: 0 };
  }

  private async checkPercentageDiscount(
    product: Product
  ): Promise<Partial<PriceAnalysis>> {
    const { price, originalPrice } = product;

    if (!originalPrice) return { isPricingError: false, confidence: 0 };

    const discountPercent = 
      ((originalPrice - price) / originalPrice) * 100;

    // Suspiciously high discounts (>70%) are often errors
    if (discountPercent > 70 && discountPercent < 100) {
      return {
        isPricingError: true,
        confidence: 80,
        errorType: 'percentage',
        profitMargin: discountPercent,
      };
    }

    // 50-70% discounts are worth investigating
    if (discountPercent > 50) {
      return {
        isPricingError: true,
        confidence: 60,
        errorType: 'percentage',
        profitMargin: discountPercent,
      };
    }

    return { isPricingError: false, confidence: 0 };
  }

  private async checkHistoricalPricing(
    product: Product
  ): Promise<Partial<PriceAnalysis>> {
    // Get 30-day price history
    const history = await db.priceHistory.findMany({
      where: {
        productUrl: product.url,
        scrapedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { scrapedAt: 'asc' },
    });

    if (history.length < 5) {
      // Not enough data
      return { confidence: 0 };
    }

    // Calculate average and standard deviation
    const prices = history.map(h => h.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(
      prices.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / prices.length
    );

    // Current price is >3 std deviations below average
    const zScore = (avg - product.price) / stdDev;
    
    if (zScore > 3) {
      return {
        isPricingError: true,
        confidence: Math.min(70 + zScore * 5, 95),
        historicalAverage: avg,
        profitMargin: ((avg - product.price) / product.price) * 100,
      };
    }

    return { historicalAverage: avg };
  }

  private async checkCompetitorPricing(
    product: Product
  ): Promise<Partial<PriceAnalysis>> {
    // Find similar products from other retailers
    const competitors = await db.product.findMany({
      where: {
        title: {
          contains: this.extractKeywords(product.title),
        },
        retailer: {
          not: product.retailer,
        },
        scrapedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      take: 10,
    });

    if (competitors.length < 3) {
      return { confidence: 0 };
    }

    const competitorPrices = competitors.map(c => c.price);
    const avgCompetitorPrice = 
      competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;

    const priceDiff = 
      ((avgCompetitorPrice - product.price) / avgCompetitorPrice) * 100;

    if (priceDiff > 40) {
      return {
        isPricingError: true,
        confidence: 75,
        competitorPrices,
        profitMargin: priceDiff,
      };
    }

    return { competitorPrices };
  }

  private async checkCouponStacking(
    product: Product
  ): Promise<Partial<PriceAnalysis>> {
    // Check product description for multiple discounts
    const description = product.description?.toLowerCase() || '';
    
    const discountKeywords = [
      'coupon',
      'promo',
      'subscribe and save',
      'extra',
      'additional',
    ];

    const matches = discountKeywords.filter(keyword => 
      description.includes(keyword)
    );

    if (matches.length >= 2) {
      return {
        isPricingError: true,
        confidence: 65,
        errorType: 'coupon_stack',
      };
    }

    return { confidence: 0 };
  }

  private combineAnalyses(
    analyses: Partial<PriceAnalysis>[]
  ): PriceAnalysis {
    const errors = analyses.filter(a => a.isPricingError);

    if (errors.length === 0) {
      return {
        isPricingError: false,
        confidence: 0,
        errorType: 'unknown',
        profitMargin: 0,
      };
    }

    // Weighted confidence (more signals = higher confidence)
    const avgConfidence = 
      errors.reduce((sum, e) => sum + (e.confidence || 0), 0) / errors.length;
    const signalBonus = Math.min(errors.length * 10, 30);
    const finalConfidence = Math.min(avgConfidence + signalBonus, 100);

    // Use highest confidence error type
    const topError = errors.reduce((max, e) => 
      (e.confidence || 0) > (max.confidence || 0) ? e : max
    );

    return {
      isPricingError: finalConfidence >= 60,
      confidence: finalConfidence,
      errorType: topError.errorType || 'unknown',
      profitMargin: Math.max(...errors.map(e => e.profitMargin || 0)),
      historicalAverage: analyses.find(a => a.historicalAverage)?.historicalAverage,
      competitorPrices: analyses.find(a => a.competitorPrices)?.competitorPrices,
    };
  }

  private extractKeywords(title: string): string {
    // Remove common words and extract key product identifiers
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at'];
    const words = title.toLowerCase()
      .split(/\s+/)
      .filter(word => 
        !stopWords.includes(word) && word.length > 2
      );
    
    return words.slice(0, 3).join(' ');
  }
}
```

### 2. Stock Availability Check

```typescript
export class StockChecker {
  async checkAvailability(product: Product): Promise<{
    inStock: boolean;
    quantity?: number;
    shippingAvailable: boolean;
  }> {
    // Make request to product page
    const page = await this.getProductPage(product.url);

    const inStock = await this.checkInStockStatus(page);
    const quantity = await this.estimateQuantity(page);
    const shippingAvailable = await this.checkShipping(page);

    return {
      inStock,
      quantity,
      shippingAvailable,
    };
  }

  private async checkInStockStatus(page: Page): Promise<boolean> {
    // Common out-of-stock indicators
    const outOfStockSelectors = [
      'text="Out of Stock"',
      'text="Currently Unavailable"',
      'text="Sold Out"',
      '[data-availability="OUT_OF_STOCK"]',
    ];

    for (const selector of outOfStockSelectors) {
      const element = await page.$(selector);
      if (element) return false;
    }

    // Check for add-to-cart button
    const addToCartButton = await page.$(
      'button:has-text("Add to Cart"), button:has-text("Add to Basket")'
    );

    return addToCartButton !== null;
  }

  private async estimateQuantity(page: Page): Promise<number | undefined> {
    // Try to find quantity selector
    const quantitySelector = await page.$('select[name="quantity"]');
    
    if (quantitySelector) {
      const options = await quantitySelector.$$('option');
      if (options.length > 0) {
        const lastOption = options[options.length - 1];
        const value = await lastOption.getAttribute('value');
        return parseInt(value || '0');
      }
    }

    return undefined;
  }
}
```

### 3. Deduplication

```typescript
export class DeduplicationEngine {
  async deduplicateDeals(
    deals: PricingError[]
  ): Promise<PricingError[]> {
    const uniqueDeals = new Map<string, PricingError>();

    for (const deal of deals) {
      const fingerprint = this.generateFingerprint(deal);
      
      const existing = uniqueDeals.get(fingerprint);
      if (!existing || deal.confidence > existing.confidence) {
        uniqueDeals.set(fingerprint, deal);
      }
    }

    return Array.from(uniqueDeals.values());
  }

  private generateFingerprint(deal: PricingError): string {
    // Normalize title for comparison
    const normalizedTitle = deal.product.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 50);

    // Round price to avoid minor variations
    const roundedPrice = Math.round(deal.product.price * 100) / 100;

    return `${deal.product.retailer}-${normalizedTitle}-${roundedPrice}`;
  }
}
```

## Machine Learning Model

### Training Data Collection

```python
# collect_training_data.py
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://...')

# Fetch labeled data (pricing errors confirmed/denied by users)
query = """
SELECT 
    p.title,
    p.price,
    p.original_price,
    p.retailer,
    p.category,
    pe.error_type,
    pe.confidence,
    pe.profit_margin,
    uf.is_valid_error,
    uf.was_order_fulfilled,
    uf.feedback_score
FROM products p
JOIN pricing_errors pe ON p.id = pe.product_id
JOIN user_feedback uf ON pe.id = uf.pricing_error_id
WHERE uf.created_at > NOW() - INTERVAL '90 days'
"""

df = pd.read_sql(query, engine)

# Feature engineering
df['discount_percent'] = (
    (df['original_price'] - df['price']) / df['original_price'] * 100
)
df['price_ratio'] = df['price'] / df['original_price']
df['title_length'] = df['title'].str.len()

# Save for training
df.to_csv('training_data.csv', index=False)
```

### Model Training

```python
# train_model.py
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib

# Load data
df = pd.read_csv('training_data.csv')

# Features
features = [
    'discount_percent',
    'price_ratio',
    'confidence',
    'profit_margin',
    'title_length',
]

X = df[features]
y = df['is_valid_error']

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42
)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

# Save model
joblib.dump(model, 'pricing_error_classifier.pkl')
```

### Model Serving

```typescript
import * as tf from '@tensorflow/tfjs-node';
import { PrismaClient } from '@prisma/client';

export class MLPredictionService {
  private model: tf.LayersModel | null = null;

  async initialize(): Promise<void> {
    this.model = await tf.loadLayersModel(
      'file://./models/pricing_error_model/model.json'
    );
  }

  async predictPricingError(
    analysis: PriceAnalysis
  ): Promise<number> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    // Prepare features
    const features = tf.tensor2d([[
      analysis.profitMargin,
      analysis.confidence,
      // Add more features...
    ]]);

    // Predict
    const prediction = this.model.predict(features) as tf.Tensor;
    const probability = (await prediction.data())[0];

    return probability;
  }
}
```

## Performance Metrics

```typescript
export class AnalyticsTracker {
  async trackDealPerformance(deal: PricingError): Promise<void> {
    await db.dealMetrics.create({
      data: {
        dealId: deal.id,
        discoveredAt: new Date(),
        notifiedUsers: 0,
        clickedUsers: 0,
        purchasedUsers: 0,
        averageOrderValue: 0,
        fulfillmentRate: 0,
      },
    });
  }

  async updateFulfillmentRate(
    dealId: string,
    wasFulfilled: boolean
  ): Promise<void> {
    const metrics = await db.dealMetrics.findUnique({
      where: { dealId },
    });

    if (!metrics) return;

    const totalAttempts = metrics.purchasedUsers;
    const fulfilled = wasFulfilled 
      ? metrics.fulfillmentRate * totalAttempts + 1
      : metrics.fulfillmentRate * totalAttempts;

    await db.dealMetrics.update({
      where: { dealId },
      data: {
        fulfillmentRate: fulfilled / (totalAttempts + 1),
      },
    });
  }
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { PriceAnalysisEngine } from './analysis-engine';

describe('PriceAnalysisEngine', () => {
  const engine = new PriceAnalysisEngine();

  it('detects decimal errors', async () => {
    const product = {
      title: 'Sony 65" 4K TV',
      price: 1.99,
      originalPrice: 1999.99,
      retailer: 'test',
    };

    const analysis = await engine.analyzeProduct(product);

    expect(analysis.isPricingError).toBe(true);
    expect(analysis.errorType).toBe('decimal');
    expect(analysis.confidence).toBeGreaterThan(90);
  });

  it('detects percentage discounts', async () => {
    const product = {
      title: 'Laptop',
      price: 250,
      originalPrice: 1000,
      retailer: 'test',
    };

    const analysis = await engine.analyzeProduct(product);

    expect(analysis.isPricingError).toBe(true);
    expect(analysis.profitMargin).toBe(75);
  });
});
```
