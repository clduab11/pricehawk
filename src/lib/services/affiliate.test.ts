
import { describe, test, expect } from 'vitest';
import { AffiliateService } from './affiliate';

describe('AffiliateService', () => {
    
    test('should inject Amazon tag correctly', () => {
        const url = 'https://www.amazon.com/dp/B08N5KWB9H';
        const result = AffiliateService.transformUrl(url, 'amazon');
        expect(result).toContain('tag=pricehawk-20');
        expect(result).toContain('https://www.amazon.com/dp/B08N5KWB9H');
    });

    test('should replace existing Amazon tag', () => {
        const url = 'https://www.amazon.com/dp/B08N5KWB9H?tag=old-tag';
        const result = AffiliateService.transformUrl(url, 'amazon');
        expect(result).toContain('tag=pricehawk-20');
        expect(result).not.toContain('tag=old-tag');
    });

    test('should preserve other Amazon params', () => {
        const url = 'https://www.amazon.com/dp/B08N5KWB9H?th=1&psc=1';
        const result = AffiliateService.transformUrl(url, 'amazon');
        expect(result).toContain('tag=pricehawk-20');
        expect(result).toContain('th=1');
        expect(result).toContain('psc=1');
    });

    test('should append UTM source for generic retailers', () => {
        const url = 'https://www.bestbuy.com/site/some-product/1234.p';
        const result = AffiliateService.transformUrl(url, 'bestbuy');
        expect(result).toContain('utm_source=pricehawk');
        expect(result).toContain('utm_medium=social');
    });

    test('should handle invalid URLs gracefully', () => {
        const url = 'not-a-url';
        const result = AffiliateService.transformUrl(url, 'amazon');
        expect(result).toBe('not-a-url');
    });
});
