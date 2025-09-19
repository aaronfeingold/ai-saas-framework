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

export interface EmailVerificationVariables {
  firstName: string;
  verificationUrl: string;
  expiryHours?: number;
}

interface EmailVerificationProps extends EmailVerificationVariables {}

export const EmailVerificationEmail = ({
  firstName = 'User',
  verificationUrl = '#',
  expiryHours = 24,
}: EmailVerificationProps) => {
  const previewText = `Verify your email address to complete your account setup`;

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
          
          <Heading style={h1}>Verify Your Email Address</Heading>
          
          <Text style={text}>
            Hi {firstName},
          </Text>
          
          <Text style={text}>
            Welcome to AI SaaS Platform! We're excited to have you on board. 
            To complete your account setup and ensure the security of your account, 
            please verify your email address by clicking the button below.
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Verify Email Address
            </Button>
          </Section>
          
          <Text style={text}>
            Or copy and paste this URL into your browser:
          </Text>
          
          <Text style={urlText}>
            {verificationUrl}
          </Text>
          
          <Section style={warningBox}>
            <Text style={warningText}>
              <strong>Important:</strong> This verification link will expire in {expiryHours} hours 
              for security reasons. If you didn't create an account with us, you can safely 
              ignore this email.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* What's Next Section */}
          <Section style={infoSection}>
            <Text style={text}>
              <strong>After verification, you'll be able to:</strong>
            </Text>
            <ul style={list}>
              <li style={listItem}>Access your personalized dashboard</li>
              <li style={listItem}>Start using all platform features</li>
              <li style={listItem}>Receive important account notifications</li>
              <li style={listItem}>Manage your subscription and billing</li>
            </ul>
          </Section>

          {/* Security Notice */}
          <Section style={securitySection}>
            <Text style={securityTitle}>🔒 Security Notice</Text>
            <Text style={securityText}>
              We sent this email to verify your identity and secure your account. 
              If you didn't sign up for AI SaaS Platform, please ignore this email. 
              No account will be created without email verification.
            </Text>
          </Section>
          
          <Text style={text}>
            If you have any questions or need assistance, don't hesitate to reach out 
            to our support team. We're here to help you get started!
          </Text>
          
          <Text style={text}>
            Best regards,<br />
            The AI SaaS Team
          </Text>
          
          <Section style={footer}>
            <Text style={footerText}>
              This verification email was sent to you because someone created an account 
              using this email address.
            </Text>
            <Text style={footerText}>
              AI SaaS Platform | 
              <Link href="#" style={footerLink}> Help Center</Link> |
              <Link href="#" style={footerLink}> Contact Support</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default EmailVerificationEmail;

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

const h1 = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '0 24px',
};

const urlText = {
  color: '#4F46E5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '0 24px',
  wordBreak: 'break-all' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
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

const warningBox = {
  backgroundColor: '#EBF8FF',
  border: '1px solid '#3B82F6',
  borderRadius: '6px',
  margin: '24px',
  padding: '16px',
};

const warningText = {
  color: '#1E40AF',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const divider = {
  borderColor: '#E5E7EB',
  margin: '32px 24px',
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

const securitySection = {
  backgroundColor: '#F0FDF4',
  border: '1px solid #16A34A',
  borderRadius: '6px',
  margin: '32px 24px',
  padding: '16px',
};

const securityTitle = {
  color: '#15803D',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const securityText = {
  color: '#15803D',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
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
  margin: '8px 0',
  textAlign: 'center' as const,
};

const footerLink = {
  color: '#4F46E5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '12px',
  textDecoration: 'underline',
};