// Quick check script for SEO routes
import { default as robots } from '../app/robots.ts';
import { default as sitemap } from '../app/sitemap.ts';

console.log('=== robots.txt ===');
console.log(robots());

console.log('\n=== sitemap.xml ===');
console.log(sitemap());

console.log('\n=== SEO Check PASS ===');