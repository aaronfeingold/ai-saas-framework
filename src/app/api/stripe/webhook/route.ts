import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import Stripe from 'stripe';

import { handleSubscriptionChange, stripe } from '@/lib/payments/stripe';
import { EnhancedEmailService } from '@/lib/email/queue';
import { getTeamByStripeCustomerId } from '@/lib/db/queries';
import { db } from '@/lib/db/postgres';
import { teamMembers } from '@/lib/db/schema';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        await handleSubscriptionEmail(subscription, event.type);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(failedInvoice);
        break;

      case 'invoice.created':
        const newInvoice = event.data.object as Stripe.Invoice;
        await handleInvoiceCreated(newInvoice);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling webhook ${event.type}:`, error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionEmail(
  subscription: Stripe.Subscription,
  eventType: string
) {
  const customerId = subscription.customer as string;
  const team = await getTeamByStripeCustomerId(customerId);
  
  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  // Get team owner (first team member)
  const teamData = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.teamId, team.id),
    with: {
      user: true
    }
  });

  if (!teamData?.user) {
    console.error('No user found for team:', team.id);
    return;
  }

  const user = teamData.user;
  const plan = subscription.items.data[0]?.plan;
  const product = await stripe.products.retrieve(plan?.product as string);

  let changeType: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate';
  
  if (eventType === 'customer.subscription.created') {
    changeType = 'upgrade';
  } else if (eventType === 'customer.subscription.deleted') {
    changeType = 'cancel';
  } else {
    // For updates, we'd need to compare old vs new plan - defaulting to upgrade
    changeType = subscription.status === 'active' ? 'upgrade' : 'cancel';
  }

  await EnhancedEmailService.sendEmailWithQueue(
    user.email,
    getSubscriptionChangeSubject(changeType, product.name),
    'subscription-change',
    {
      firstName: user.fullName.split(' ')[0] || user.displayName || 'User',
      changeType,
      oldPlan: team.planName,
      newPlan: product.name,
      effectiveDate: new Date(subscription.current_period_start * 1000).toISOString(),
      nextBillingDate: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : undefined,
      amount: plan?.amount ? formatStripeAmount(plan.amount, plan.currency) : undefined,
      currency: plan?.currency?.toUpperCase(),
    },
    { priority: 'high' }
  );
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const team = await getTeamByStripeCustomerId(customerId);
  
  if (!team || !invoice.subscription) {
    return;
  }

  const teamData = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.teamId, team.id),
    with: {
      user: true
    }
  });

  if (!teamData?.user) return;

  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );
  const plan = subscription.items.data[0]?.plan;
  const product = await stripe.products.retrieve(plan?.product as string);

  await EnhancedEmailService.sendEmailWithQueue(
    teamData.user.email,
    `Payment Confirmed - ${product.name}`,
    'payment-confirmation',
    {
      firstName: teamData.user.fullName.split(' ')[0] || teamData.user.displayName || 'User',
      amount: formatStripeAmount(invoice.amount_paid, invoice.currency),
      currency: invoice.currency.toUpperCase(),
      planName: product.name,
      invoiceUrl: invoice.hosted_invoice_url || '#',
      subscriptionStatus: subscription.status === 'active' ? 'active' : 'trialing',
      billingPeriod: plan?.interval === 'month' ? 'monthly' : 'yearly',
      nextBillingDate: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : undefined,
      transactionId: invoice.payment_intent as string,
    },
    { priority: 'high' }
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const team = await getTeamByStripeCustomerId(customerId);
  
  if (!team) return;

  const teamData = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.teamId, team.id),
    with: {
      user: true
    }
  });

  if (!teamData?.user) return;

  // Send payment failed notification
  await EnhancedEmailService.sendEmailWithQueue(
    teamData.user.email,
    'Payment Failed - Action Required',
    'notification',
    {
      title: 'Payment Failed',
      message: `Your payment for ${team.planName} has failed. Please update your payment method to avoid service interruption.`,
      actionUrl: `${process.env.BASE_URL}/account/billing`,
      actionText: 'Update Payment Method',
    },
    { priority: 'high' }
  );
}

async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const team = await getTeamByStripeCustomerId(customerId);
  
  if (!team || !invoice.subscription) return;

  const teamData = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.teamId, team.id),
    with: {
      user: true
    }
  });

  if (!teamData?.user) return;

  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );
  const plan = subscription.items.data[0]?.plan;

  await EnhancedEmailService.sendEmailWithQueue(
    teamData.user.email,
    `Invoice ${invoice.number} - ${formatStripeAmount(invoice.total, invoice.currency)}`,
    'invoice',
    {
      firstName: teamData.user.fullName.split(' ')[0] || teamData.user.displayName || 'User',
      invoiceNumber: invoice.number || 'Unknown',
      amount: formatStripeAmount(invoice.total, invoice.currency),
      currency: invoice.currency.toUpperCase(),
      dueDate: invoice.due_date 
        ? new Date(invoice.due_date * 1000).toISOString()
        : new Date().toISOString(),
      invoiceUrl: invoice.hosted_invoice_url || '#',
      planName: team.planName || 'Plan',
      billingPeriod: plan?.interval === 'month' ? 'monthly' : 'yearly',
      paymentMethod: invoice.default_payment_method 
        ? `Payment method on file` 
        : undefined,
    },
    { priority: 'normal' }
  );
}

function getSubscriptionChangeSubject(
  changeType: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate',
  planName: string
): string {
  switch (changeType) {
    case 'upgrade':
      return `🎉 Welcome to ${planName}!`;
    case 'downgrade':
      return `Subscription Updated to ${planName}`;
    case 'cancel':
      return `Subscription Cancelled`;
    case 'reactivate':
      return `🎉 Welcome Back to ${planName}!`;
    default:
      return `Subscription Updated`;
  }
}

function formatStripeAmount(amount: number, currency: string): string {
  // Stripe amounts are in cents for most currencies
  const divisor = currency.toLowerCase() === 'jpy' ? 1 : 100;
  const formattedAmount = (amount / divisor).toFixed(2);
  return formattedAmount;
}
