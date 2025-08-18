-- Enhanced Chat System Migration
-- This migration sets up the complete chat system with document search capabilities

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table (mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_title TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  content TEXT,
  is_user_message BOOLEAN NOT NULL,
  reasoning TEXT,
  sources JSONB,
  tool_invocations JSONB,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_user ON chat_messages(is_user_message);

-- Create user_documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filter_tags TEXT NOT NULL,
  total_pages INTEGER NOT NULL,
  ai_title TEXT,
  ai_description TEXT,
  ai_maintopics TEXT[],
  ai_keyentities TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for user_documents
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_title ON user_documents(title);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON user_documents(created_at DESC);

-- Create user_documents_vec table for vector embeddings
CREATE TABLE IF NOT EXISTS user_documents_vec (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  embedding VECTOR(1024) -- Voyage AI embeddings are 1024-dimensional
);

-- Create indexes for user_documents_vec
CREATE INDEX IF NOT EXISTS idx_user_documents_vec_doc_id ON user_documents_vec(document_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_vec_page ON user_documents_vec(page_number);

-- Create HNSW index for vector similarity search (more efficient than ivfflat for this use case)
CREATE INDEX IF NOT EXISTS idx_user_documents_vec_embedding 
ON user_documents_vec USING hnsw (embedding vector_cosine_ops);

-- Create error_feedback table for monitoring
CREATE TABLE IF NOT EXISTS error_feedback (
  id SERIAL PRIMARY KEY,
  feedback TEXT NOT NULL,
  category TEXT,
  errormessage TEXT,
  errorstack TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for error_feedback
CREATE INDEX IF NOT EXISTS idx_error_feedback_category ON error_feedback(category);
CREATE INDEX IF NOT EXISTS idx_error_feedback_created_at ON error_feedback(created_at DESC);

-- Create RPC function for document similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1024),
  match_count INTEGER,
  filter_user_id UUID,
  filter_files TEXT[],
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  text_content TEXT,
  title TEXT,
  doc_timestamp TIMESTAMPTZ,
  ai_title TEXT,
  ai_description TEXT,
  ai_maintopics TEXT[],
  ai_keyentities TEXT[],
  filter_tags TEXT,
  page_number INTEGER,
  total_pages INTEGER,
  similarity FLOAT
)
LANGUAGE SQL
AS $$
  SELECT 
    udv.id,
    udv.text_content,
    ud.title,
    ud.created_at as doc_timestamp,
    ud.ai_title,
    ud.ai_description,
    ud.ai_maintopics,
    ud.ai_keyentities,
    ud.filter_tags,
    udv.page_number,
    ud.total_pages,
    1 - (udv.embedding <=> query_embedding) as similarity
  FROM user_documents_vec udv
  JOIN user_documents ud ON udv.document_id = ud.id
  WHERE 
    ud.user_id = filter_user_id
    AND (
      cardinality(filter_files) = 0 
      OR ud.title = ANY(filter_files)
    )
    AND 1 - (udv.embedding <=> query_embedding) > similarity_threshold
  ORDER BY udv.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at 
  BEFORE UPDATE ON chat_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents_vec ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Chat sessions: users can only access their own sessions
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Chat messages: users can only access messages from their own sessions
CREATE POLICY "Users can view own chat messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs 
      WHERE cs.id = chat_messages.chat_session_id 
      AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chat messages in own sessions" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions cs 
      WHERE cs.id = chat_messages.chat_session_id 
      AND cs.user_id = auth.uid()
    )
  );

-- User documents: users can only access their own documents
CREATE POLICY "Users can view own documents" ON user_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own documents" ON user_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON user_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON user_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Document vectors: users can only access vectors from their own documents
CREATE POLICY "Users can view own document vectors" ON user_documents_vec
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_documents ud 
      WHERE ud.id = user_documents_vec.document_id 
      AND ud.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create document vectors for own documents" ON user_documents_vec
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_documents ud 
      WHERE ud.id = user_documents_vec.document_id 
      AND ud.user_id = auth.uid()
    )
  );