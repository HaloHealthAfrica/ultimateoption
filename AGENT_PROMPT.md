# Prompt for Independent Agent Review

Copy and paste this to the other agent:

---

I need you to perform a comprehensive end-to-end review of our Phase 2.5 decision engine system. This is an independent review to catch any issues we might have missed.

**Your Task:**
1. Read `PHASE25_E2E_REVIEW_TASK.md` for detailed instructions
2. Test the complete system (webhooks, database, dashboard, APIs)
3. Review the code for issues (bugs, performance, security)
4. Document all findings in `PHASE25_E2E_REVIEW_REPORT.md`
5. Implement fixes for Critical and High Priority issues
6. Verify all fixes work

**Key Areas to Focus On:**
- Webhook processing and decision making
- Database persistence and data integrity
- Dashboard functionality (especially on refresh)
- API endpoint reliability
- Error handling and edge cases
- Performance and security

**Test Scripts Available:**
- `test-with-both-webhooks.js` - Test complete webhook flow
- `test-ledger-direct.js` - Test database storage
- `check-schema.js` - Verify database schema

**Production URL:** https://optionstrat.vercel.app

**Expected Deliverables:**
1. Complete review report with all findings categorized by priority
2. Fixes for all Critical and High Priority issues
3. Verification that fixes work
4. Updated documentation

**Success Criteria:**
- System works end-to-end without errors
- Dashboard loads and refreshes reliably
- All data persists correctly
- No critical issues remain

Please be thorough and document everything you find. Start by reading the task file, then begin testing.

---

**Additional Context:**
The system receives webhooks from 5 sources, makes trading decisions, stores them in PostgreSQL, and displays them on a dashboard. We recently fixed database persistence issues and dashboard hydration crashes. We need you to verify everything works correctly and catch any remaining issues.
