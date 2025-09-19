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

import type { NotificationEmailVariables } from '../types';

interface NotificationEmailProps extends NotificationEmailVariables {}

export const NotificationEmail = ({
  title = 'Notification',
  message = 'You have a new notification.',
  actionUrl,
  actionText,
}: NotificationEmailProps) => {
  const previewText = `${title} - ${message}`;

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
          
          <Heading style={h1}>{title}</Heading>
          
          <Text style={text}>
            Hello,
          </Text>
          
          <Section style={messageBox}>
            <Text style={messageText}>
              {message}
            </Text>
          </Section>
          
          {actionUrl && actionText && (
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                {actionText}
              </Button>
            </Section>
          )}
          
          <Text style={text}>
            This notification was sent from your AI SaaS Platform account. If you have 
            any questions or concerns, please don't hesitate to contact our support team.
          </Text>
          
          <Text style={text}>
            Best regards,<br />
            The AI SaaS Team
          </Text>
          
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated notification from AI SaaS Platform.
            </Text>
            <Text style={footerText}>
              <Link href="#" style={footerLink}>Manage Notifications</Link> | 
              <Link href="#" style={footerLink}> Support</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default NotificationEmail;

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

const messageBox = {
  backgroundColor: '#F3F4F6',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  margin: '24px',
  padding: '20px',
};

const messageText = {
  color: '#374151',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  textAlign: 'center' as const,
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
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segue UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
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