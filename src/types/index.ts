import { z } from 'zod';

// Product Schema
export const ProductSchema = z.object({
  id: z.string(),
  product_name: z.string(),
  current_price: z.number().positive(),
  original_price: z.number().positive().nullable(),
  stock_status: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'unknown']),
  retailer_id: z.string(),
  last_checked: z.string().datetime(),
  url: z.string().url(),
  image_url: z.string().url().optional(),
  category: z.string().optional(),
  retailer_sku: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

// Pricing Anomaly Schema
export const PricingAnomalySchema = z.object({
  id: z.string(),
  product_id: z.string(),
  product: ProductSchema,
  anomaly_type: z.enum(['z_score', 'percentage_drop', 'decimal_error', 'historical']),
  z_score: z.number().optional(),
  discount_percentage: z.number(),
  initial_confidence: z.number().min(0).max(100),
  detected_at: z.string().datetime(),
  status: z.enum(['pending', 'validated', 'rejected', 'notified']),
});

export type PricingAnomaly = z.infer<typeof PricingAnomalySchema>;

// Validation Result Schema
export const ValidationResultSchema = z.object({
  is_glitch: z.boolean(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  glitch_type: z.enum(['decimal_error', 'database_error', 'clearance', 'coupon_stack', 'unknown']),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Validated Glitch Schema
export const ValidatedGlitchSchema = z.object({
  id: z.string(),
  anomaly_id: z.string(),
  product: ProductSchema,
  validation: ValidationResultSchema,
  profit_margin: z.number(),
  estimated_duration: z.string().optional(),
  validated_at: z.string().datetime(),
});

export type ValidatedGlitch = z.infer<typeof ValidatedGlitchSchema>;

// Notification Schema
export const NotificationSchema = z.object({
  id: z.string(),
  glitch_id: z.string(),
  channel: z.enum(['facebook', 'discord', 'sms']),
  message: z.object({
    title: z.string(),
    body: z.string(),
    image_url: z.string().url().optional(),
    link: z.string().url(),
    pricing: z.object({
      current: z.number(),
      original: z.number(),
      savings: z.number(),
      discount_percent: z.number(),
    }),
  }),
  status: z.enum(['pending', 'sent', 'delivered', 'failed']),
  created_at: z.string().datetime(),
  delivered_at: z.string().datetime().optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

// Notification Result
export interface NotificationResult {
  success: boolean;
  channel: 'facebook' | 'discord' | 'sms';
  messageId?: string;
  error?: string;
  sentAt: string;
}

// Notification Provider Interface
export interface NotificationProvider {
  send(glitch: ValidatedGlitch): Promise<NotificationResult>;
}

// Scrape Result
export interface ScrapeResult {
  success: boolean;
  product?: Product;
  anomaly?: PricingAnomaly;
  error?: string;
}

// Detect Result
export interface DetectResult {
  is_anomaly: boolean;
  anomaly_type?: PricingAnomaly['anomaly_type'];
  z_score?: number;
  discount_percentage?: number;
  confidence: number;
}
