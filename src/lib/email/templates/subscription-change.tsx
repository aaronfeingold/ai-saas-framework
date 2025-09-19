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

import type { SubscriptionChangeEmailVariables } from '../types';

interface SubscriptionChangeEmailProps extends SubscriptionChangeEmailVariables {}

export const SubscriptionChangeEmail = ({
  firstName = 'User',
  changeType = 'upgrade',
  oldPlan,
  newPlan,
  effectiveDate = '',
  nextBillingDate,
  amount,
  currency = 'USD',
  reason,
}: SubscriptionChangeEmailProps) => {
  const getChangeTitle = () => {
    switch (changeType) {
      case 'upgrade':
        return '🎉 Subscription Upgraded!';
      case 'downgrade':
        return 'Subscription Plan Changed';
      case 'cancel':
        return 'Subscription Cancelled';
      case 'reactivate':
        return '🎉 Subscription Reactivated!';
      default:
        return 'Subscription Updated';
    }
  };

  const getChangeMessage = () => {
    switch (changeType) {
      case 'upgrade':
        return `Congratulations! Your subscription has been upgraded from ${oldPlan} to ${newPlan}. You now have access to all the enhanced features of your new plan.`;
      case 'downgrade':
        return `Your subscription has been changed from ${oldPlan} to ${newPlan}. The change will take effect on ${formatDate(effectiveDate)}.`;
      case 'cancel':
        return `Your subscription has been cancelled. You'll continue to have access to ${oldPlan} features until ${formatDate(effectiveDate)}, after which your account will be downgraded to our free plan.`;
      case 'reactivate':
        return `Welcome back! Your ${newPlan} subscription has been reactivated and you now have full access to all features.`;
      default:
        return `Your subscription has been updated.`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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

  const getChangeColor = () => {
    switch (changeType) {
      case 'upgrade':
      case 'reactivate':
        return '#10B981';
      case 'cancel':
        return '#EF4444';
      case 'downgrade':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const previewText = `${getChangeTitle()} - ${changeType === 'cancel' ? 'Effective' : 'Changed to'} ${newPlan || oldPlan}`;

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
            <Heading style={h1}>{getChangeTitle()}</Heading>
            <Text style={text}>
              Hi {firstName},
            </Text>
            <Text style={text}>
              {getChangeMessage()}
            </Text>
          </Section>

          {/* Change Summary Card */}
          <Section style={changeCard}>
            <Section style={changeHeader}>
              <Text style={changeTitle}>Change Summary</Text>
              <span style={{
                ...changeBadge,
                backgroundColor: getChangeColor(),
              }}>
                {changeType.charAt(0).toUpperCase() + changeType.slice(1)}
              </span>
            </Section>
            
            {oldPlan && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>Previous Plan</Text>
                <Text style={summaryValue}>{oldPlan}</Text>
              </Section>
            )}
            
            {newPlan && changeType !== 'cancel' && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>New Plan</Text>
                <Text style={summaryValue}>{newPlan}</Text>
              </Section>
            )}
            
            <Section style={summaryRow}>
              <Text style={summaryLabel}>
                {changeType === 'cancel' ? 'Service Ends' : 'Effective Date'}
              </Text>
              <Text style={summaryValue}>{formatDate(effectiveDate)}</Text>
            </Section>
            
            {amount && changeType !== 'cancel' && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>
                  {changeType === 'upgrade' ? 'New Amount' : 'Updated Amount'}
                </Text>
                <Text style={summaryValue}>{formatAmount(amount, currency)}</Text>
              </Section>
            )}
            
            {nextBillingDate && changeType !== 'cancel' && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>Next Billing Date</Text>
                <Text style={summaryValue}>{formatDate(nextBillingDate)}</Text>
              </Section>
            )}
            
            {reason && (
              <Section style={summaryRow}>
                <Text style={summaryLabel}>Reason</Text>
                <Text style={summaryValue}>{reason}</Text>
              </Section>
            )}
          </Section>

          <Hr style={divider} />

          {/* Action Buttons */}
          {changeType !== 'cancel' ? (
            <>
              <Section style={buttonContainer}>
                <Button style={primaryButton} href={`${process.env.BASE_URL || ''}/dashboard`}>
                  Explore Your Features
                </Button>
              </Section>
              
              <Section style={buttonContainer}>
                <Button style={secondaryButton} href={`${process.env.BASE_URL || ''}/account/billing`}>
                  Manage Billing
                </Button>
              </Section>
            </>
          ) : (
            <Section style={buttonContainer}>
              <Button style={primaryButton} href={`${process.env.BASE_URL || ''}/account/billing`}>
                Reactivate Subscription
              </Button>
            </Section>
          )}

          {/* What's Next Section */}
          <Section style={infoSection}>
            <Heading style={sectionTitle}>
              {changeType === 'cancel' ? 'What happens now?' : "What's next?"}
            </Heading>
            
            {changeType === 'upgrade' && (
              <ul style={list}>
                <li style={listItem}>You now have immediate access to all {newPlan} features</li>
                <li style={listItem}>Your next billing cycle will reflect the new pricing</li>
                <li style={listItem}>Explore the enhanced features in your dashboard</li>
                <li style={listItem}>Contact support if you need help with new features</li>
              </ul>
            )}
            
            {changeType === 'downgrade' && (
              <ul style={list}>
                <li style={listItem}>Your plan will change to {newPlan} on {formatDate(effectiveDate)}</li>
                <li style={listItem}>You'll retain current features until the effective date</li>
                <li style={listItem}>New billing amount will apply on your next cycle</li>
                <li style={listItem}>You can upgrade again anytime before the change</li>
              </ul>
            )}
            
            {changeType === 'cancel' && (
              <ul style={list}>
                <li style={listItem}>You'll keep full access to {oldPlan} until {formatDate(effectiveDate)}</li>
                <li style={listItem}>After that, you'll be moved to our free plan</li>
                <li style={listItem}>Your data and account will be preserved</li>
                <li style={listItem}>You can reactivate your subscription anytime</li>
              </ul>
            )}
            
            {changeType === 'reactivate' && (
              <ul style={list}>
                <li style={listItem}>Your {newPlan} subscription is now active</li>
                <li style={listItem}>All features are immediately available</li>
                <li style={listItem}>Billing will resume on your next cycle</li>
                <li style={listItem}>Welcome back to the full experience!</li>
              </ul>
            )}
          </Section>

          {/* Support Section */}
          <Section style={supportSection}>
            <Text style={supportText}>
              Have questions about your subscription change?
            </Text>
            <Link href={`${process.env.BASE_URL || ''}/support`} style={supportLink}>
              Contact our support team
            </Link>
          </Section>

          <Text style={text}>
            {changeType === 'cancel' ? 
              'We\'re sorry to see you go, but you\'re always welcome back!' :
              'Thank you for choosing our platform!'
            }<br />
            The AI SaaS Team
          </Text>
          
          <Section style={footer}>
            <Text style={footerText}>
              Subscription {changeType} effective {formatDate(effectiveDate)}
            </Text>
            <Link href={`${process.env.BASE_URL || ''}/account/billing`} style={footerLink}>
              Manage Subscription
            </Link>
            <Text style={footerText}>•</Text>
            <Link href={`${process.env.BASE_URL || ''}/support`} style={footerLink}>
              Get Help
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default SubscriptionChangeEmail;

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

const changeCard = {
  backgroundColor: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  margin: '24px',
  padding: '24px',
};

const changeHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  paddingBottom: '16px',
  borderBottom: '2px solid #E5E7EB',
} as const;

const changeTitle = {
  color: '#111827',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
};

const changeBadge = {
  padding: '4px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#FFFFFF',
  textTransform: 'capitalize' as const,
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