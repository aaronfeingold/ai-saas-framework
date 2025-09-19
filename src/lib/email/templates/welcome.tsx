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
} from '@react-email/components';
import * as React from 'react';

import type { WelcomeEmailVariables } from '../types';

interface WelcomeEmailProps extends WelcomeEmailVariables {}

export const WelcomeEmail = ({
  firstName = 'User',
  loginUrl = '#',
}: WelcomeEmailProps) => {
  const previewText = `Welcome to our platform, ${firstName}!`;

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
          
          <Heading style={h1}>Welcome to AI SaaS Platform!</Heading>
          
          <Text style={text}>
            Hi {firstName},
          </Text>
          
          <Text style={text}>
            Welcome to our AI SaaS platform! We're excited to have you on board. 
            Your account has been successfully created and you can now access all 
            the powerful features our platform has to offer.
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Get Started
            </Button>
          </Section>
          
          <Text style={text}>
            Here's what you can do next:
          </Text>
          
          <ul style={list}>
            <li style={listItem}>Complete your profile setup</li>
            <li style={listItem}>Explore our AI-powered features</li>
            <li style={listItem}>Join our community chat</li>
            <li style={listItem}>Check out our getting started guide</li>
          </ul>
          
          <Text style={text}>
            If you have any questions or need assistance, don't hesitate to reach out 
            to our support team. We're here to help you succeed!
          </Text>
          
          <Text style={text}>
            Best regards,<br />
            The AI SaaS Team
          </Text>
          
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent to you because you created an account on our platform.
            </Text>
            <Link
              href="#"
              style={footerLink}
            >
              Unsubscribe
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

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

const list = {
  color: '#333',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '0 24px',
};

const listItem = {
  margin: '8px 0',
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
  margin: '16px 0',
  textAlign: 'center' as const,
};

const footerLink = {
  color: '#4F46E5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '12px',
  textDecoration: 'underline',
};