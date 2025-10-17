#!/bin/bash

# Load testing script for the sample application
# Generates various types of requests to test observability

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

APP_URL="http://localhost:8080"
DURATION=${1:-60}  # Default 60 seconds

print_status "Starting load test for $DURATION seconds..."
print_status "Target: $APP_URL"

# Check if app is reachable
if ! curl -s "$APP_URL/api/health" > /dev/null; then
    print_warning "Application not reachable at $APP_URL"
    print_status "Make sure port forwarding is active: kubectl port-forward -n default svc/web-app 8080:8080"
    exit 1
fi

# Function to make requests
make_requests() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-""}
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -s -X POST -H "Content-Type: application/json" -d "$data" "$APP_URL$endpoint" > /dev/null
    else
        curl -s "$APP_URL$endpoint" > /dev/null
    fi
}

# Start background processes to generate load
print_status "Generating load..."

# Normal requests
(
    end_time=$((SECONDS + DURATION))
    while [ $SECONDS -lt $end_time ]; do
        make_requests "/"
        make_requests "/api/health"
        make_requests "/api/users"
        make_requests "/api/users/1"
        make_requests "/api/users/2"
        sleep 0.5
    done
) &

# Some slow requests
(
    end_time=$((SECONDS + DURATION))
    while [ $SECONDS -lt $end_time ]; do
        make_requests "/api/slow"
        sleep 2
    done
) &

# Some error requests
(
    end_time=$((SECONDS + DURATION))
    while [ $SECONDS -lt $end_time ]; do
        make_requests "/api/error"
        make_requests "/api/users/999"  # Not found
        sleep 3
    done
) &

# Some POST requests
(
    end_time=$((SECONDS + DURATION))
    counter=1
    while [ $SECONDS -lt $end_time ]; do
        user_data="{\"name\":\"Test User $counter\",\"email\":\"test$counter@example.com\",\"role\":\"user\"}"
        make_requests "/api/users" "POST" "$user_data"
        counter=$((counter + 1))
        sleep 4
    done
) &

# High frequency requests
(
    end_time=$((SECONDS + DURATION))
    while [ $SECONDS -lt $end_time ]; do
        for i in {1..10}; do
            make_requests "/api/health"
        done
        sleep 1
    done
) &

# Wait for all background processes to complete
wait

print_success "Load test completed!"
print_status "Check Grafana dashboards to see the generated metrics, logs, and traces"
print_status "Grafana: http://localhost:3000 (admin/admin)"