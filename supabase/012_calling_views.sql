-- Track which users have viewed which callings (for "NEW" badge)
CREATE TABLE calling_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calling_id UUID NOT NULL REFERENCES callings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(calling_id, user_id)
);

CREATE INDEX idx_calling_views_user ON calling_views(user_id);
CREATE INDEX idx_calling_views_calling ON calling_views(calling_id);

ALTER TABLE calling_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own views"
  ON calling_views FOR ALL
  USING (user_id = auth.uid());
