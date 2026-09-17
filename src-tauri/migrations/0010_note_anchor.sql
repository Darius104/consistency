-- Which tag-group (by tag id, or NULL for "before all groups") a note is
-- anchored after, so notes can be dragged to any position among that day's
-- tag groups instead of always sitting fixed at the top of the list.
ALTER TABLE notes ADD COLUMN after_group_key TEXT;
