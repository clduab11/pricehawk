# Detection Algorithms

This document describes the anomaly detection algorithms used by PriceHawk to identify pricing errors and exceptional deals.

## Overview

PriceHawk uses a multi-layered detection approach combining statistical methods with AI validation:

1. **Statistical Detection Layer**: Fast, rule-based detection using 5 algorithms
2. **AI Validation Layer**: DeepSeek V3 via OpenRouter for secondary filtering
3. **Category-Specific Tuning**: Threshold adjustments based on product category
4. **Temporal Context**: Confidence adjustments based on time of detection

## Detection Algorithms

### 1. Decimal Error Detection

**Purpose**: Catch obvious pricing mistakes where a decimal point is misplaced.

**Logic**:
- Flags prices where `currentPrice / originalPrice < 0.1` (90%+ drop)
- Also flags `currentPrice / originalPrice > 10` (10x price hike)

**Confidence**: 95% (highest - these are almost always genuine errors)

**Example**:
- Original: $99.99 → Listed: $9.99 (ratio = 0.1, flagged as decimal error)
- Original: $49.99 → Listed: $499.99 (ratio = 10, flagged as decimal error)

### 2. Z-Score Analysis

**Purpose**: Detect prices that deviate significantly from historical averages.

**Formula**:
```
Z-Score = (Historical Mean - Current Price) / Standard Deviation
```

**Threshold**: Z-Score > 3 (with at least 30 historical samples)

**Why 30 samples?**: Statistical reliability requires sufficient sample size for meaningful standard deviation calculation.

**Confidence Calculation**: `70 + min(zScore * 5, 20)`

### 3. Double MAD (Median Absolute Deviation)

**Purpose**: Robust outlier detection for asymmetric price distributions.

**Why Double MAD?**: Retail prices are typically right-skewed (few high outliers from surge pricing). Double MAD handles this by calculating separate MAD values for prices below and above the median.

**Formula**:
```
MAD = 1.4826 × median(|Xi - median(X)|)
Modified Z-Score = (median(X) - Xi) / MAD
```

**Threshold**: MAD Score > 3.0 (configurable per category)

**Requirements**: Minimum 10 historical samples

### 4. Adjusted IQR (Interquartile Range)

**Purpose**: Box-plot based outlier detection with skewness correction.

**Formula** (Adjusted Boxplot with Medcouple):
```
Lower Fence = Q1 - multiplier × e^(-4×MC) × IQR
Upper Fence = Q3 + multiplier × e^(3×MC) × IQR
```

Where:
- `Q1`, `Q3` = First and third quartiles
- `IQR` = Q3 - Q1
- `MC` = Medcouple (measure of skewness, -1 to +1)
- `multiplier` = Configurable (default: 2.2, Hoaglin & Iglewicz tuned)

**Why Adjusted?**: Standard IQR assumes symmetric distributions. Adjusted IQR accounts for the right-skewed nature of retail pricing.

### 5. Category-Specific Thresholds

**Purpose**: Apply domain-appropriate sensitivity levels.

| Category | Drop Threshold | MAD Threshold | IQR Multiplier | Confidence Boost |
|----------|---------------|---------------|----------------|------------------|
| Grocery | 30% | 2.0 | 1.8 | +15 |
| Electronics | 40% | 2.5 | 2.0 | +10 |
| Computers | 40% | 2.5 | 2.0 | +10 |
| Fashion | 60% | 3.5 | 2.5 | 0 |
| Apparel | 60% | 3.5 | 2.5 | 0 |
| Home | 50% | 3.0 | 2.2 | +5 |
| Toys | 55% | 3.2 | 2.3 | 0 |
| Default | 50% | 3.0 | 2.2 | 0 |

**Rationale**:
- **Grocery**: Very sensitive - prices rarely drop significantly
- **Electronics**: Sensitive - frequent pricing glitches from inventory systems
- **Fashion**: Less sensitive - frequent sales and clearances expected
- **Toys**: Moderate - seasonal variance considered

## Temporal Context Analysis

### Maintenance Windows

Anomalies detected during these times receive a confidence boost:

- **2-5 AM** (any day): +10-15 confidence
- **Sunday 10 PM - Monday 2 AM**: +10 confidence

**Rationale**: Pricing errors often occur during overnight maintenance windows when inventory systems are updated.

### Low-Confidence Flagging

Anomalies detected during maintenance windows are flagged as "low confidence" in the temporal context, even if the confidence score is high. This allows downstream systems to apply additional scrutiny.

## Detection Priority

When multiple detection methods trigger, the anomaly type is assigned in this priority:

1. **Decimal Error** (highest confidence)
2. **MAD Score** (robust to outliers)
3. **IQR Outlier** (complementary to MAD)
4. **Z-Score** (traditional but requires more data)
5. **Percentage Drop** (fallback)

## Confidence Scoring

Final confidence is calculated as:

```
Base Confidence
  + Category Boost (0-15)
  + Temporal Boost (0-15)
  + Multiple Signal Bonus (if MAD + IQR + % drop all trigger)
  = Final Confidence (capped at 100)
```

### Confidence Tiers

| Score | Classification | Action |
|-------|----------------|--------|
| 95+ | Critical | Immediate notification to all tiers |
| 85-94 | High | Pro/Elite immediate, Starter 24h |
| 70-84 | Medium | Standard tier delays applied |
| 50-69 | Low | May require additional validation |
| <50 | Uncertain | Logged but not notified |

## AI Validation Layer

After statistical detection, anomalies are validated by DeepSeek V3:

1. **Context Analysis**: AI reviews product category, historical trends, and seasonal patterns
2. **Glitch Classification**: Determines if anomaly is genuine error vs. legitimate sale
3. **Duration Estimation**: Predicts how long the deal will last
4. **Reasoning**: Provides human-readable explanation

**Expected FP Reduction**: ≥50% of false positives caught by AI validation

## Tuning Parameters

### Environment Variables

```bash
# Detection thresholds
DETECTION_MIN_SAMPLES=10        # Minimum historical samples for MAD/IQR
DETECTION_ZSCORE_MIN_SAMPLES=30 # Minimum samples for Z-score

# Confidence thresholds
CONFIDENCE_MIN_NOTIFY=50        # Minimum confidence to send notifications
CONFIDENCE_HIGH_PRIORITY=85     # Threshold for high-priority alerts

# AI Validation
AI_VALIDATION_TIMEOUT=15000     # Timeout for AI validation in ms
ENABLE_SOTA_MODELS=true         # Use premium models for unicorn opportunities
```

### Unicorn Detection

"Unicorn" opportunities (exceptional deals) trigger premium AI model validation:

- Discount > 85% with high confidence (90+)
- Z-score > 4.5 (extreme anomaly)
- High-value items ($500+) with 70%+ discount
- Decimal error patterns

## Testing

Detection algorithms are tested in `src/lib/analysis/detection.test.ts`:

```bash
npm test -- src/lib/analysis/detection.test.ts
```

### Test Corpus

For production validation, a 100-product test corpus is used:
- 50 "normal sale" prices (should not trigger)
- 30 genuine pricing errors (should trigger)
- 20 edge cases (borderline scenarios)

**Target Metrics**:
- False Positive Rate: < 15%
- Detection Accuracy: ≥ 85%
- Detection Latency: < 30 seconds

## References

- Hubert, M. & Vandervieren, E. (2008). An adjusted boxplot for skewed distributions.
- Brys, G., Hubert, M. & Struyf, A. (2004). A robust measure of skewness.
- Rousseeuw, P.J. & Croux, C. (1993). Alternatives to the Median Absolute Deviation.
