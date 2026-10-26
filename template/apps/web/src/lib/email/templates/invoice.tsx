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

import type { InvoiceEmailVariables } from '../types';

interface InvoiceEmailProps extends InvoiceEmailVariables {}

export const InvoiceEmail = ({
  firstName = 'User',
  invoiceNumber = 'INV-001',
  amount = '$0.00',
  currency = 'USD',
  dueDate = '',
  invoiceUrl = '#',
  planName = 'Pro Plan',
  billingPeriod = 'monthly',
  paymentMethod = 'Visa ending in 4242',
}: InvoiceEmailProps) => {
  const previewText = `Invoice ${invoiceNumber} - ${amount} due ${new Date(dueDate).toLocaleDateString()}`;
  
  const formatAmount = (amount: string, currency: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
            <Heading style={h1}>Invoice {invoiceNumber}</Heading>
            <Text style={text}>
              Hi {firstName},
            </Text>
            <Text style={text}>
              Your invoice for {planName} is now available. Please review the details below 
              and ensure payment is made by the due date to continue enjoying uninterrupted service.
            </Text>
          </Section>

          {/* Invoice Summary Card */}
          <Section style={invoiceCard}>
            <Section style={invoiceHeader}>
              <Text style={invoiceTitle}>Invoice Summary</Text>
              <Text style={invoiceNumber}>#{invoiceNumber}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Plan</Text>
              <Text style={summaryValue}>{planName}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Billing Period</Text>
              <Text style={summaryValue}>{billingPeriod}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Amount Due</Text>
              <Text style={amountDue}>{formatAmount(amount, currency)}</Text>
            </Section>
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>Due Date</Text>
              <Text style={dueDateValue}>{formatDate(dueDate)}</Text>
            </Section>
            
            {paymentMethod && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>Payment Method</Text>
                <Text style={summaryValue}>{paymentMethod}</Text>
              </Section>
            )}
          </Section>

          <Hr style={divider} />

          {/* Action Buttons */}
          <Section style={buttonContainer}>
            <Button style={primaryButton} href={invoiceUrl}>
              View Full Invoice
            </Button>
          </Section>

          <Section style={buttonContainer}>
            <Button style={secondaryButton} href={`${process.env.BASE_URL || ''}/account/billing`}>
              Manage Billing
            </Button>
          </Section>

          {/* Payment Information */}
          <Section style={paymentInfoSection}>
            <Heading style={sectionTitle}>Payment Instructions</Heading>
            <ul style={list}>
              <li style={listItem}>
                Payment will be automatically charged to your default payment method
              </li>
              <li style={listItem}>
                If payment fails, we'll retry up to 3 times over the next week
              </li>
              <li style={listItem}>
                Update your payment method anytime in your billing settings
              </li>
              <li style={listItem}>
                Download your invoice for tax and accounting purposes
              </li>
            </ul>
          </Section>

          {/* Important Notice */}
          <Section style={noticeSection}>
            <Text style={noticeTitle}>💡 Important Notice</Text>
            <Text style={noticeText}>
              To avoid service interruption, please ensure your payment method is up to date. 
              If you have any issues with billing or need to update your payment information, 
              please contact our support team.
            </Text>
          </Section>

          {/* Support Information */}
          <Section style={supportSection}>
            <Text style={supportText}>
              Questions about your invoice or billing?
            </Text>
            <Link href={`${process.env.BASE_URL || ''}/support`} style={supportLink}>
              Contact our billing support team
            </Link>
          </Section>

          <Text style={text}>
            Thank you for your business!<br />
            The AI SaaS Team
          </Text>
          
          <Section style={footer}>
            <Text style={footerText}>
              Invoice #{invoiceNumber} • Due {formatDate(dueDate)}
            </Text>
            <Link href={invoiceUrl} style={footerLink}>
              View Invoice
            </Link>
            <Text style={footerText}>•</Text>
            <Link href={`${process.env.BASE_URL || ''}/account/billing`} style={footerLink}>
              Billing Settings
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default InvoiceEmail;

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

const sectionTitle = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '24px 0 16px 0',
  padding: '0',
};

const text = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
};

const invoiceCard = {
  backgroundColor: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  margin: '24px',
  padding: '24px',
};

const invoiceHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  paddingBottom: '16px',
  borderBottom: '2px solid #E5E7EB',
} as const;

const invoiceTitle = {
  color: '#111827',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
};

const invoiceNumber = {
  color: '#6B7280',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
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

const amountDue = {
  color: '#DC2626',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'right' as const,
  flex: '1',
};

const dueDateValue = {
  color: '#DC2626',
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

const paymentInfoSection = {
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

const noticeSection = {
  backgroundColor: '#FEF3C7',
  border: '1px solid #F59E0B',
  borderRadius: '6px',
  margin: '32px 24px',
  padding: '16px',
};

const noticeTitle = {
  color: '#92400E',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const noticeText = {
  color: '#92400E',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
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