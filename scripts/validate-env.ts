#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 * 
 * Run this script before deploying to production to ensure all required
 * environment variables are present and properly formatted.
 * 
 * Usage: npx tsx scripts/validate-env.ts
 */

import { config } from 'dotenv';

// Load environment variables
config();

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  secret?: boolean;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string',
    validator: (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
  },
  
  // Redis
  {
    name: 'REDIS_HOST',
    required: true,
    description: 'Redis host address',
  },
  {
    name: 'REDIS_PORT',
    required: true,
    description: 'Redis port number',
    validator: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0 && parseInt(v) < 65536,
  },
  
  // Clerk Authentication
  {
    name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    required: true,
    description: 'Clerk publishable key',
    validator: (v) => v.startsWith('pk_'),
  },
  {
    name: 'CLERK_SECRET_KEY',
    required: true,
    description: 'Clerk secret key',
    validator: (v) => v.startsWith('sk_'),
    secret: true,
  },
  
  // Stripe
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe secret key',
    validator: (v) => v.startsWith('sk_'),
    secret: true,
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    description: 'Stripe webhook signing secret',
    validator: (v) => v.startsWith('whsec_'),
    secret: true,
  },
  
  // OpenRouter AI
  {
    name: 'OPENROUTER_API_KEY',
    required: true,
    description: 'OpenRouter API key for AI validation',
    validator: (v) => v.startsWith('sk-or-'),
    secret: true,
  },
  
  // Notifications - Discord
  {
    name: 'DISCORD_WEBHOOK_URL',
    required: false,
    description: 'Discord webhook URL for notifications',
    validator: (v) => v.startsWith('https://discord.com/api/webhooks/'),
  },
  
  // Notifications - Twilio SMS
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio account SID',
    validator: (v) => v.startsWith('AC'),
    secret: true,
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio auth token',
    secret: true,
  },
  {
    name: 'TWILIO_PHONE_NUMBER',
    required: false,
    description: 'Twilio phone number',
    validator: (v) => v.startsWith('+'),
  },
  
  // Notifications - Resend Email
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for email',
    validator: (v) => v.startsWith('re_'),
    secret: true,
  },
  
  // Notifications - Telegram
  {
    name: 'TELEGRAM_BOT_TOKEN',
    required: false,
    description: 'Telegram bot token',
    secret: true,
  },
  
  // Application
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Application base URL',
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
  },
  
  // Database Pool
  {
    name: 'DATABASE_POOL_MIN',
    required: false,
    description: 'Minimum database pool connections (default: 10)',
    validator: (v) => !isNaN(parseInt(v)) && parseInt(v) >= 0,
  },
  {
    name: 'DATABASE_POOL_MAX',
    required: false,
    description: 'Maximum database pool connections (default: 30)',
    validator: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
  },
  
  // Cron & Admin
  {
    name: 'CRON_SECRET',
    required: true,
    description: 'Secret for cron job authentication',
    secret: true,
  },
  {
    name: 'ADMIN_SECRET',
    required: true,
    description: 'Secret for admin endpoints',
    secret: true,
  },
];

interface ValidationResult {
  name: string;
  status: 'present' | 'missing' | 'invalid';
  message: string;
}

function validateEnvironment(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value || value.trim() === '') {
      if (envVar.required) {
        results.push({
          name: envVar.name,
          status: 'missing',
          message: `Missing required variable: ${envVar.description}`,
        });
      } else {
        results.push({
          name: envVar.name,
          status: 'missing',
          message: `Optional variable not set: ${envVar.description}`,
        });
      }
      continue;
    }
    
    if (envVar.validator && !envVar.validator(value)) {
      results.push({
        name: envVar.name,
        status: 'invalid',
        message: `Invalid format for ${envVar.description}`,
      });
      continue;
    }
    
    const displayValue = envVar.secret
      ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
      : value;
      
    results.push({
      name: envVar.name,
      status: 'present',
      message: `Valid: ${displayValue}`,
    });
  }
  
  return results;
}

function printResults(results: ValidationResult[]): void {
  console.log('\n🔍 Environment Variable Validation\n');
  console.log('='.repeat(60));
  
  const required = results.filter((r) => 
    REQUIRED_ENV_VARS.find((e) => e.name === r.name)?.required
  );
  const optional = results.filter((r) => 
    !REQUIRED_ENV_VARS.find((e) => e.name === r.name)?.required
  );
  
  console.log('\n📋 Required Variables:\n');
  for (const result of required) {
    const icon = result.status === 'present' ? '✅' : result.status === 'invalid' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.name}`);
    console.log(`     ${result.message}`);
  }
  
  console.log('\n📋 Optional Variables:\n');
  for (const result of optional) {
    const icon = result.status === 'present' ? '✅' : result.status === 'invalid' ? '⚠️' : '⚪';
    console.log(`  ${icon} ${result.name}`);
    console.log(`     ${result.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  
  const missingRequired = required.filter((r) => r.status === 'missing');
  const invalidVars = results.filter((r) => r.status === 'invalid');
  
  if (missingRequired.length === 0 && invalidVars.length === 0) {
    console.log('\n✅ All required environment variables are valid!\n');
  } else {
    console.log(`\n❌ Validation failed:`);
    console.log(`   - ${missingRequired.length} missing required variables`);
    console.log(`   - ${invalidVars.length} invalid variables\n`);
    process.exit(1);
  }
}

// Run validation
const results = validateEnvironment();
printResults(results);
