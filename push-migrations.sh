#!/bin/bash

# Script to push all SQL migrations to Supabase
# Usage:
#   ./push-migrations.sh                    # Push to linked project
#   ./push-migrations.sh --db-url "..."      # Push to specific database
#   ./push-migrations.sh --local            # Push to local database

set -e

echo "🚀 Supabase Migration Pusher"
echo "============================"
echo ""

# Check if migrations directory exists
if [ ! -d "supabase/migrations" ]; then
    echo "❌ Error: supabase/migrations directory not found"
    exit 1
fi

# Count migration files
MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "📁 Found $MIGRATION_COUNT migration files"
echo ""

# List all migrations
echo "📋 Migration files (in order):"
ls -1 supabase/migrations/*.sql | sort -V | nl
echo ""

# Check if project is linked
if [ "$1" != "--db-url" ] && [ "$1" != "--local" ]; then
    echo "🔗 Checking project link..."
    if supabase status &>/dev/null || [ -f "supabase/.temp/project-ref" ]; then
        echo "✅ Project is linked"
        echo ""
        echo "📤 Pushing migrations to linked project..."
        supabase db push --linked
    else
        echo "⚠️  No project linked. Options:"
        echo ""
        echo "1. Link to a remote project:"
        echo "   supabase link --project-ref YOUR_PROJECT_REF"
        echo ""
        echo "2. Push to local database (requires Docker):"
        echo "   supabase start"
        echo "   supabase db push --local"
        echo ""
        echo "3. Push to specific database:"
        echo "   supabase db push --db-url 'postgresql://user:pass@host:port/dbname'"
        echo ""
        exit 1
    fi
elif [ "$1" == "--local" ]; then
    echo "📤 Pushing migrations to local database..."
    supabase db push --local
elif [ "$1" == "--db-url" ]; then
    if [ -z "$2" ]; then
        echo "❌ Error: --db-url requires a database URL"
        exit 1
    fi
    echo "📤 Pushing migrations to specified database..."
    supabase db push --db-url "$2"
fi

echo ""
echo "✅ Migrations pushed successfully!"
echo ""

