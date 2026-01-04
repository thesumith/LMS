#!/bin/bash

# Quick script to create test users
# Usage: ./scripts/create-test-users.sh

echo "🚀 Creating Test Users for LMS..."
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please install Node.js to run this script"
    exit 1
fi

# Check if environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL not set"
    echo "   Using Supabase CLI to get URL..."
    
    # Try to get from Supabase CLI
    SUPABASE_URL=$(supabase status 2>/dev/null | grep "API URL" | awk '{print $3}' | head -1)
    
    if [ -z "$SUPABASE_URL" ]; then
        echo "❌ Could not determine Supabase URL"
        echo "   Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL"
        exit 1
    fi
    
    export SUPABASE_URL
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not set"
    echo "   You can find it in: Supabase Dashboard → Settings → API → service_role key"
    echo ""
    read -p "Enter your Supabase Service Role Key: " SERVICE_KEY
    export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
fi

# Check if tsx is available, if not, try ts-node or node
if command -v tsx &> /dev/null; then
    echo "✅ Using tsx to run TypeScript..."
    tsx scripts/create-test-users.ts
elif command -v ts-node &> /dev/null; then
    echo "✅ Using ts-node to run TypeScript..."
    ts-node scripts/create-test-users.ts
else
    echo "⚠️  tsx or ts-node not found"
    echo "   Installing tsx..."
    npm install -g tsx
    tsx scripts/create-test-users.ts
fi

