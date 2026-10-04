-- Each logged result now remembers its OWN unit at the time it was saved,
-- instead of being reinterpreted under whatever the global display
-- preference happens to be set to later - a "+4" logged as a percent is
-- not the same number as "+4" meant as dollars, so switching the display
-- preference must never retroactively relabel a day that was already
-- logged under a different unit. Existing rows (all logged before this
-- distinction existed) default to 'r', the app's own original default.
ALTER TABLE trading_results ADD COLUMN unit TEXT NOT NULL DEFAULT 'r';
