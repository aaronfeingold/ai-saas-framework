import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

import type { PaymentConfirmationEmailVariables } from '../types';

interface PaymentConfirmationEmailProps extends PaymentConfirmationEmailVariables {}

export const PaymentConfirmationEmail = ({
  firstName = 'User',
  amount = '$0.00',
  currency = 'USD',
  planName = 'Pro Plan',
  invoiceUrl = '#',
  subscriptionStatus = 'active',
  billingPeriod = 'monthly',
  nextBillingDate,
  transactionId,
}: PaymentConfirmationEmailProps) => {
  const previewText = `Payment confirmed for ${planName} - ${amount}`;
  
  const formatAmount = (amount: string, currency: string) => {
    // Handle different currency formatting
    const currencySymbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: 'C$',
      AUD: 'A$',
    };
    
    const symbol = currencySymbols[currency.toUpperCase()] || currency.toUpperCase();
    const numericAmount = amount.replace(/[^\d.,]/g, '');
    return `${symbol}${numericAmount}`;
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://via.placeholder.com/150x50/4F46E5/FFFFFF?text=AI+SaaS"
              width="150"
              height="50"
              alt="AI SaaS Platform"
              style={logo}
            />
          </Section>
          
          <Section style={headerSection}>
            <Heading style={h1}>Payment Confirmed!</Heading>
            <Text style={text}>
              Hi {firstName},
            </Text>
            <Text style={text}>
              Thank you for your payment! We've successfully processed your subscription 
              payment and your account has been updated.
            </Text>
          </Section>

          {/* Payment Summary Card */}
          <Section style={paymentCard}>
            <Heading style={cardTitle}>Payment Summary</Heading>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Plan</Text>
              <Text style={summaryValue}>{planName}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Amount Paid</Text>
              <Text style={summaryValue}>{formatAmount(amount, currency)}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Billing Period</Text>
              <Text style={summaryValue}>{billingPeriod}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Status</Text>
              <Text style={summaryValue}>
                <span style={statusBadge(subscriptionStatus)}>
                  {subscriptionStatus === 'active' ? '✓ Active' : 
                   subscriptionStatus === 'trialing' ? '🆕 Trial' : 
                   subscriptionStatus}
                </span>
              </Text>
            </Section>
            
            {nextBillingDate && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>Next Billing Date</Text>
                <Text style={summaryValue}>
                  {new Date(nextBillingDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </Section>
            )}
            
            {transactionId && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>Transaction ID</Text>
                <Text style={summaryValue}>{transactionId}</Text>
              </Section>
            )}
          </Section>

          <Hr style={divider} />

          {/* Action Buttons */}
          <Section style={buttonContainer}>
            <Button style={primaryButton} href={invoiceUrl}>
              Download Invoice
            </Button>
          </Section>

          <Section style={buttonContainer}>
            <Button style={secondaryButton} href={`${process.env.BASE_URL || ''}/dashboard`}>
              Go to Dashboard
            </Button>
          </Section>

          {/* Additional Information */}
          <Section style={infoSection}>
            <Text style={text}>
              <strong>What happens next?</strong>
            </Text>
            <ul style={list}>
              <li style={listItem}>
                Your subscription is now {subscriptionStatus === 'active' ? 'active' : 'in trial period'}
              </li>
              <li style={listItem}>
                You have full access to all {planName} features
              </li>
              <li style={listItem}>
                {nextBillingDate ? 
                  `Your next payment will be processed on ${new Date(nextBillingDate).toLocaleDateString()}` :
                  'You can manage your subscription anytime in your dashboard'
                }
              </li>
              <li style={listItem}>
                You can download your invoice anytime from your account
              </li>
            </ul>
          </Section>

          {/* Support Information */}
          <Section style={supportSection}>
            <Text style={supportText}>
              Need help or have questions about your subscription?
            </Text>
            <Link href={`${process.env.BASE_URL || ''}/support`} style={supportLink}>
              Contact our support team
            </Link>
          </Section>

          <Text style={text}>
            Best regards,<br />
            The AI SaaS Team
          </Text>
          
          <Section style={footer}>
            <Text style={footerText}>
              This is a receipt for your payment. Keep this email for your records.
            </Text>
            <Link href={`${process.env.BASE_URL || ''}/account/billing`} style={footerLink}>
              Manage Billing
            </Link>
            <Text style={footerText}>•</Text>
            <Link href={`${process.env.BASE_URL || ''}/support`} style={footerLink}>
              Get Support
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PaymentConfirmationEmail;

// Helper function for status styling
const statusBadge = (status: string) => ({
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
  backgroundColor: status === 'active' ? '#10B981' : 
                   status === 'trialing' ? '#F59E0B' : '#6B7280',
  color: '#FFFFFF',
});

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const logoContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
};

const headerSection = {
  padding: '0 24px',
};

const h1 = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const cardTitle = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
  padding: '0',
};

const text = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
};

const paymentCard = {
  backgroundColor: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  margin: '24px',
  padding: '24px',
};

const summaryRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid #E5E7EB',
} as const;

const summaryLabel = {
  color: '#6B7280',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  margin: '0',
  flex: '1',
};

const summaryValue = {
  color: '#111827',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'right' as const,
  flex: '1',
};

const divider = {
  borderColor: '#E5E7EB',
  margin: '32px 24px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const primaryButton = {
  backgroundColor: '#4F46E5',
  borderRadius: '6px',
  color: '#fff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  margin: '0 auto',
  width: 'fit-content',
};

const secondaryButton = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  color: '#374151',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  margin: '0 auto',
  width: 'fit-content',
};

const infoSection = {
  padding: '0 24px',
  margin: '32px 0',
};

const list = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
  paddingLeft: '20px',
};

const listItem = {
  margin: '8px 0',
};

const supportSection = {
  textAlign: 'center' as const,
  padding: '32px 24px',
  backgroundColor: '#F3F4F6',
  borderRadius: '8px',
  margin: '32px 24px',
};

const supportText = {
  color: '#374151',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  margin: '0 0 12px 0',
};

const supportLink = {
  color: '#4F46E5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'underline',
};

const footer = {
  margin: '32px 0',
  textAlign: 'center' as const,
  borderTop: '1px solid #eaeaea',
  paddingTop: '32px',
};

const footerText = {
  color: '#666',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 8px',
  display: 'inline',
};

const footerLink = {
  color: '#4F46E5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '12px',
  textDecoration: 'underline',
  margin: '0 8px',
};