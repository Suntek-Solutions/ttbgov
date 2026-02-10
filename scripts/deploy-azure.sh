#!/bin/bash
# =============================================================================
# Azure Container Apps Deployment Script
# TTB Label Verification App
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Docker installed (for local build/push)
#
# Usage:
#   ./scripts/deploy-azure.sh
#
# Configuration is driven by environment variables or the defaults below.
# Override any value by setting the env var before running:
#   AZURE_RESOURCE_GROUP=my-group ./scripts/deploy-azure.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via environment variables)
# ---------------------------------------------------------------------------

AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ttb-label-verification-rg}"
AZURE_LOCATION="${AZURE_LOCATION:-eastus}"
AZURE_ACR_NAME="${AZURE_ACR_NAME:-ttblabelacr}"
AZURE_CONTAINER_ENV="${AZURE_CONTAINER_ENV:-ttb-label-env}"
AZURE_APP_NAME="${AZURE_APP_NAME:-ttb-label-verification}"
DOCKER_IMAGE_TAG="${DOCKER_IMAGE_TAG:-latest}"

# Derived
ACR_LOGIN_SERVER="${AZURE_ACR_NAME}.azurecr.io"
FULL_IMAGE="${ACR_LOGIN_SERVER}/${AZURE_APP_NAME}:${DOCKER_IMAGE_TAG}"

echo "============================================="
echo "TTB Label Verification -- Azure Deployment"
echo "============================================="
echo "Resource Group:  ${AZURE_RESOURCE_GROUP}"
echo "Location:        ${AZURE_LOCATION}"
echo "ACR:             ${AZURE_ACR_NAME}"
echo "Container Env:   ${AZURE_CONTAINER_ENV}"
echo "App Name:        ${AZURE_APP_NAME}"
echo "Image:           ${FULL_IMAGE}"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# Step 1: Ensure resource group exists
# ---------------------------------------------------------------------------
echo "[1/6] Creating resource group (if not exists)..."
az group create \
  --name "${AZURE_RESOURCE_GROUP}" \
  --location "${AZURE_LOCATION}" \
  --output none 2>/dev/null || true
echo "  Done."

# ---------------------------------------------------------------------------
# Step 2: Create Azure Container Registry (if not exists)
# ---------------------------------------------------------------------------
echo "[2/6] Creating container registry (if not exists)..."
az acr create \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --name "${AZURE_ACR_NAME}" \
  --sku Basic \
  --admin-enabled true \
  --output none 2>/dev/null || true
echo "  Done."

# ---------------------------------------------------------------------------
# Step 3: Build and push Docker image to ACR
# ---------------------------------------------------------------------------
echo "[3/6] Building and pushing Docker image to ACR..."
az acr build \
  --registry "${AZURE_ACR_NAME}" \
  --image "${AZURE_APP_NAME}:${DOCKER_IMAGE_TAG}" \
  --file Dockerfile \
  .
echo "  Done."

# ---------------------------------------------------------------------------
# Step 4: Create Container Apps environment (if not exists)
# ---------------------------------------------------------------------------
echo "[4/6] Creating Container Apps environment (if not exists)..."
az containerapp env create \
  --name "${AZURE_CONTAINER_ENV}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --location "${AZURE_LOCATION}" \
  --output none 2>/dev/null || true
echo "  Done."

# ---------------------------------------------------------------------------
# Step 5: Deploy (create or update) the Container App
# ---------------------------------------------------------------------------
echo "[5/6] Deploying container app..."

# Get ACR credentials
ACR_PASSWORD=$(az acr credential show \
  --name "${AZURE_ACR_NAME}" \
  --query "passwords[0].value" \
  --output tsv)

az containerapp create \
  --name "${AZURE_APP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --environment "${AZURE_CONTAINER_ENV}" \
  --image "${FULL_IMAGE}" \
  --registry-server "${ACR_LOGIN_SERVER}" \
  --registry-username "${AZURE_ACR_NAME}" \
  --registry-password "${ACR_PASSWORD}" \
  --target-port 3000 \
  --ingress external \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --output none 2>/dev/null || \
az containerapp update \
  --name "${AZURE_APP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --image "${FULL_IMAGE}" \
  --output none
echo "  Done."

# ---------------------------------------------------------------------------
# Step 6: Get the deployed URL
# ---------------------------------------------------------------------------
echo "[6/6] Getting deployed URL..."
APP_URL=$(az containerapp show \
  --name "${AZURE_APP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv)

echo ""
echo "============================================="
echo "Deployment complete!"
echo "============================================="
echo ""
echo "  URL: https://${APP_URL}"
echo ""
echo "  Update README.md with this URL."
echo "============================================="
