/**
 * Stripe Connect payment service for MCP contracts.
 * 10% platform fee (vs 30% on the existing marketplace).
 */

import Stripe from "stripe";
import { ToolError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// MCP platform fee: 10%
export const MCP_PLATFORM_FEE_PERCENT = 10;
export const MCP_TALENT_PERCENT = 90;

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new ToolError(
      "SERVICE_UNAVAILABLE",
      "Stripe is not configured. Payment features are unavailable.",
      "Set STRIPE_SECRET_KEY in your environment.",
    );
  }

  stripeInstance = new Stripe(key, {
    apiVersion: "2025-12-15.clover" as Stripe.LatestApiVersion,
    typescript: true,
  });

  return stripeInstance;
}

export function calculateMcpPaymentSplit(totalAmountCents: number) {
  const platformFeeCents = Math.round(totalAmountCents * (MCP_PLATFORM_FEE_PERCENT / 100));
  const talentAmountCents = totalAmountCents - platformFeeCents;

  return {
    totalAmountCents,
    platformFeeCents,
    talentAmountCents,
  };
}

export async function createMcpCheckoutSession(params: {
  contractId: string;
  projectId: string;
  talentId: string;
  clientId: string;
  amountCents: number;
  projectTitle: string;
  talentName: string;
  transferGroup: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const stripe = getStripe();
  const { platformFeeCents } = calculateMcpPaymentSplit(params.amountCents);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Project: ${params.projectTitle}`,
            description: `Contract with ${params.talentName} via revolutionAI MCP`,
          },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "mcp_contract",
      contract_id: params.contractId,
      project_id: params.projectId,
      talent_id: params.talentId,
      client_id: params.clientId,
      platform_fee_cents: platformFeeCents.toString(),
      transfer_group: params.transferGroup,
    },
    payment_intent_data: {
      transfer_group: params.transferGroup,
      metadata: {
        type: "mcp_contract",
        contract_id: params.contractId,
      },
    },
    success_url: `https://revolutionai.io/dashboard/contracts/${params.contractId}?payment=success`,
    cancel_url: `https://revolutionai.io/dashboard/contracts/${params.contractId}?payment=cancelled`,
  });

  logger.info("Stripe checkout session created", {
    sessionId: session.id,
    contractId: params.contractId,
    amount: params.amountCents,
  });

  return {
    checkoutUrl: session.url ?? "",
    sessionId: session.id,
  };
}

export async function createMilestoneTransfer(params: {
  connectedAccountId: string;
  amountCents: number;
  contractId: string;
  milestoneId: string;
  transferGroup: string;
}): Promise<string> {
  const stripe = getStripe();

  const transfer = await stripe.transfers.create({
    amount: params.amountCents,
    currency: "usd",
    destination: params.connectedAccountId,
    transfer_group: params.transferGroup,
    metadata: {
      type: "mcp_milestone_payout",
      contract_id: params.contractId,
      milestone_id: params.milestoneId,
    },
  });

  logger.info("Milestone transfer created", {
    transferId: transfer.id,
    milestoneId: params.milestoneId,
    amount: params.amountCents,
  });

  return transfer.id;
}
