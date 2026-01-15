import sharp from 'sharp';
import { PriceHistory } from '@prisma/client';

export interface PriceChartOptions {
  title: string;
  data: PriceHistory[];
  width?: number;
  height?: number;
  lineColor?: string;
  fillColor?: string;
}

export class ChartGenerator {
  static async generate(options: PriceChartOptions): Promise<Buffer> {
    const { title, data, width = 1200, height = 628 } = options;
    const padding = 80;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2 - 40; // Extra for title

    if (data.length === 0) {
        return sharp({
            create: {
                width,
                height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        }).png().toBuffer();
    }

    // Sort data chronologically
    const sortedData = [...data].sort((a, b) => new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime());
    
    // Calculate scales
    const prices = sortedData.map(d => Number(d.price));
    // Add 5% padding to min/max
    const minPrice = Math.min(...prices) * 0.95; 
    const maxPrice = Math.max(...prices) * 1.05;
    
    const dates = sortedData.map(d => new Date(d.scrapedAt).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    
    const timeRange = maxDate - minDate || 1; // Avoid divide by zero
    const priceRange = maxPrice - minPrice || 1;

    // Helper to get coordinates
    const getX = (d: PriceHistory) => padding + ((new Date(d.scrapedAt).getTime() - minDate) / timeRange) * graphWidth;
    const getY = (d: PriceHistory) => (height - padding) - ((Number(d.price) - minPrice) / priceRange) * graphHeight;

    // Generate path points
    const points = sortedData.map(d => `${getX(d)},${getY(d)}`).join(' ');

    const linePath = `M ${points}`;
    
    // Fill path (close to bottom)
    const fillPath = `M ${points} L ${padding + graphWidth},${height - padding} L ${padding},${height - padding} Z`;

    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        
        <!-- Grid lines (Horizontal) & Labels -->
        ${[0, 0.25, 0.5, 0.75, 1].map(p => {
            const y = (height - padding) - (p * graphHeight);
            const priceVal = (minPrice + (p * priceRange)).toFixed(2);
             return `
               <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#eee" stroke-width="1"/>
               <text x="${padding - 10}" y="${y + 5}" font-family="Arial" font-size="14" text-anchor="end" fill="#666">$${priceVal}</text>
             `;
        }).join('')}

        <!-- Title -->
        <text x="${width/2}" y="${padding - 30}" font-family="Arial" font-size="28" font-weight="bold" text-anchor="middle" fill="#111">${title}</text>
        <text x="${width/2}" y="${padding - 5}" font-family="Arial" font-size="16" text-anchor="middle" fill="#666">Price History</text>

        <!-- Area Fill -->
        <path d="${fillPath}" fill="rgba(59, 130, 246, 0.1)" />

        <!-- Line -->
        <path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Points -->
        ${sortedData.map(d => {
             return `<circle cx="${getX(d)}" cy="${getY(d)}" r="5" fill="#2563eb" stroke="white" stroke-width="2"/>`;
        }).join('')}
        
        <!-- X Axis (Dates) - First and Last -->
        <text x="${padding}" y="${height - padding + 25}" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">${new Date(minDate).toLocaleDateString()}</text>
        <text x="${width - padding}" y="${height - padding + 25}" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">${new Date(maxDate).toLocaleDateString()}</text>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}
