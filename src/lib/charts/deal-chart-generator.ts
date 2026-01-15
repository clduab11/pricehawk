import sharp from 'sharp';
import { ValidatedGlitch } from '@/types';

export class DealChartGenerator {
  /**
   * Generates a social media ready image for a deal using SVG composition
   * dimensions: 1200x675 (Twitter card optimized)
   */
  async generateDealChart(glitch: ValidatedGlitch): Promise<Buffer> {
    const { product, profitMargin, glitchType } = glitch;
    const currentPrice = product.price;
    const originalPrice = product.originalPrice || product.price * (1 + profitMargin / 100);
    const retailer = product.retailer;
    
    // Create SVG Content
    const svg = `
      <svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -> Gradient -->
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
          </linearGradient>
           <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
            <feOffset dx="0" dy="5" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#bgGradient)"/>
        
        <!-- Header / Badge -->
        <rect x="50" y="50" width="300" height="60" rx="10" fill="#dc2626" filter="url(#shadow)"/>
        <text x="200" y="92" font-family="Arial, sans-serif" font-weight="bold" font-size="32" fill="white" text-anchor="middle">PRICE GLITCH</text>

        <!-- Product Title -->
        <text x="50" y="180" font-family="Arial, sans-serif" font-weight="bold" font-size="48" fill="white" width="1100">
          ${this.truncateText(product.title, 40)}
        </text>
        <text x="50" y="240" font-family="Arial, sans-serif" font-size="32" fill="#94a3b8">
          Found at: ${retailer.toUpperCase()}
        </text>

        <!-- Price Section -->
        <text x="50" y="400" font-family="Arial, sans-serif" font-weight="bold" font-size="120" fill="#4ade80">
          $${currentPrice.toFixed(2)}
        </text>
        
        <!-- Original Price (Strikethrough) -->
        <text x="50" y="500" font-family="Arial, sans-serif" font-size="60" fill="#94a3b8" text-decoration="line-through">
          Was: $${originalPrice.toFixed(2)}
        </text>

        <!-- Discount Badge Circle -->
        <circle cx="950" cy="400" r="150" fill="#dc2626" filter="url(#shadow)"/>
        <text x="950" y="380" font-family="Arial, sans-serif" font-weight="bold" font-size="80" fill="white" text-anchor="middle">
          ${Math.round(profitMargin)}%
        </text>
        <text x="950" y="460" font-family="Arial, sans-serif" font-weight="bold" font-size="40" fill="white" text-anchor="middle">
          OFF
        </text>

        <!-- Confidence / Type -->
        <text x="950" y="600" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">
          Confidence: ${Math.round(glitch.confidence * 100)}%
        </text>

        <!-- Branding Watermark -->
        <text x="1150" y="650" font-family="Arial, sans-serif" font-weight="bold" font-size="24" fill="white" opacity="0.5" text-anchor="end">
          PRICEHAWK AI
        </text>
      </svg>
    `;

    try {
      // Use Sharp to convert SVG buffer to PNG buffer
      return await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
    } catch (error) {
      console.error('Error generating deal chart:', error);
      throw error;
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
