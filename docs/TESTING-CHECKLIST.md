# Manual testing checklist: Gemstone Selections (M1 to M6)

Use this checklist to test the site by hand, one role at a time. Tick each box when the step works as described. The button and field names come from the automated tests, so they should match the screen. If a name is different, write it in the **Bugs found** table at the end.

Test on a laptop first, then on a phone (see "Phone" below).

---

## Before you start

### Where to open the site

- **This computer:** http://localhost:3000
- **Your phone (same Wi-Fi):** http://10.99.65.59:3000
  - The phone address can change when the computer reconnects to Wi-Fi. If the phone cannot open the site, Windows Firewall may be blocking port 3000 on the private network. Allow it when Windows asks.

### Demo logins

Every password below is for **demo and test use only**. Do not use them anywhere else.

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | admin@gemstone.local | ChangeMe-Local-1 | Full admin area |
| Demo buyer | demo-buyer-1@example.com | Demo-Buyer-Pass-1 | Has a wishlist, enquiries and a quotation |
| Demo approved seller (Premium) | himalaya-gem-house@demo.gemstone.local | Demo-Seller-Pass-1 | Approved, has listings |
| Demo approved seller (Elite, admin override) | deccan-stone-works@demo.gemstone.local | Demo-Seller-Pass-1 | Same password as every demo seller |
| Demo approved seller (Free) | malabar-precious-gems@demo.gemstone.local | Demo-Seller-Pass-1 | Free tier (25 listing limit) |
| Pending seller (not approved) | pending-seller@example.com | Pending-Seller-Pass-1 | Email already confirmed. Waiting for admin approval. No documents |
| Valuator (expert reviewer) | demo.valuer@example.test | demo-valuer-dev-only-change-me | Only sees assigned valuations |

Other demo sellers (for example `surat-colour-co@demo.gemstone.local`) also use `Demo-Seller-Pass-1`.

### Where email links and OTP codes appear

This is a development setup, so emails are **not sent**. The server writes them to a log file:

- **File:** `R:\Demo\gemstone-marketplace\.data\dev-server.log`
- **Email:** each email starts with a line `[email:console] to=<address>`. The link (for example `/verify-email?token=...`, `/reset-password?token=...`, or a newsletter `/newsletter/confirm?token=...`) is in the text under it.
- **Mobile code (OTP):** each SMS starts with `[sms:console] to=<mobile>`. The 6-digit code is in the text under it.
- **To watch the log live:** open PowerShell and run
  `Get-Content R:\Demo\gemstone-marketplace\.data\dev-server.log -Wait -Tail 40`
  then press Ctrl+C to stop.

Copy the link into the address bar of the same browser.

### Good to know

- Links and codes expire: email verification and password reset links are valid for a limited time. OTP codes last 10 minutes and allow 5 wrong tries.
- Some demo data was added for testing. Demo items are labelled **Demo** or **Demo – needs expert review**.
- Ratings, reviews and verification badges on demo sellers are demo data.

---

## 1. Visitor (not signed in)

Use a private (incognito) browser window, so you are signed out.

- [ ] **Homepage** (`/`): open http://localhost:3000.
  - You should see sections for top sellers (a horizontal scroll), featured gemstones (a horizontal scroll), categories, and teasers for Education and News.
  - Scroll the carousels with the mouse or the keyboard (Tab to a card, then arrow keys).
- [ ] **Catalogue** (`/gemstones`): click **Gemstones** in the header.
  - You should see gemstone cards with photo, name, price and seller.
  - Type a word in search (for example `sapphire`) and press Enter. Results should narrow.
  - Use **Apply filters** to filter by category or price. The list should update.
- [ ] **Category page:** click a category (for example **sapphire category**). Only that category should show.
- [ ] **Seller directory** (`/sellers`): click **Sellers** in the header. You should see approved sellers only. Pending sellers do not appear.
- [ ] **Seller profile** (`/sellers/himalaya-gem-house`): you should see the logo, banner, tagline, about text, specialties, follower count and the seller's listings.
  - A visitor cannot see the seller's phone number or email. Contact is only through the site.
- [ ] **Product page:** click any gemstone card. You should see photos, specifications, price, certificates and documents, and the seller's name.
  - The buttons **Save to wishlist**, **Chat / Enquire** and **Request valuation** should be there. Clicking them while signed out should ask you to sign in.
- [ ] **Education** (`/education`): click **Learn** or the Education teaser. You should see articles, guides and research.
  - Type in the search box. Results should match.
  - Open one article. You should see a reading time, tags, a list of related articles, and a newsletter sign-up.
- [ ] **Reference library** (`/reference`): you should see one page per gemstone category. Open one. You should see sections on properties, hardness, origins, treatments, how to judge quality, care and price. There should also be links to matching listings and to **Start a valuation**.
- [ ] **News** (`/news`): you should see news items with a date, category and source. Open one. The source name should link to the original source. Demo news says "Demo source" and does not link to a real article.
- [ ] **Newsletter sign-up** (`/newsletter` or the footer):
  - Tick at least one topic. No topic is ticked by default.
  - Enter an email you can read, for example `you+test1@example.com`.
  - Tick the consent box and click **Sign up**.
  - You should see the message "Thank you. If this address can receive our newsletter, we have sent a confirmation link."
  - In `dev-server.log`, find `[email:console] to=you+test1@example.com`. Copy the `/newsletter/confirm?token=...` link into the browser.
  - Click **Confirm my subscription**. You should see "You are subscribed. Thank you for confirming."
- [ ] **Legal pages:** open `/legal/terms`, `/legal/privacy`, `/legal/cookies`, `/legal/seller-agreement`. Each should show a banner saying **Draft – needs legal review**.
- [ ] **Cookie notice:** a bar at the bottom of the page explains the analytics cookie. Click **Got it**. The bar should go away and stay away after a page refresh.
- [ ] **404 page:** open `/this-page-does-not-exist`. You should see "We could not find that page" and a link back home.
- [ ] **Footer and header links:** click each footer and header link once. None should show a 404 page.
- [ ] **Sign-up pages:** open `/register/buyer` and `/register/seller`. Both forms should show.

---

## 2. Buyer: registration and account (M1)

- [ ] **Register:** open `/register/buyer`. Fill in:
  - **Full name**
  - **Email**
  - **Mobile number**
  - **Country**
  - **Password**
  - Click **Create buyer account**.
  - You should see a message asking you to check your email.
- [ ] **Verify email:** open `dev-server.log`, find `[email:console] to=<your email>`, copy the `/verify-email?token=...` link and open it. Click **Confirm email**. You should see that your email is confirmed.
- [ ] **Verify mobile (OTP):** go to `/verify-mobile` (you need to be signed in).
  - Click the button to send a code.
  - Find `[sms:console] to=<your mobile>` in `dev-server.log` and copy the 6-digit code.
  - Type the code and submit. You should see that your mobile is verified.
  - Try a wrong code once. You should see an error, not a success.
- [ ] **Sign in:** open `/login`. Enter the email and password, click **Log in**. You should land on your dashboard.
- [ ] **Wrong password:** log in with a wrong password. You should see a generic error. It should not say whether the email exists.
- [ ] **Forgot password:** open `/forgot-password`, enter your email, submit. You should see the same message whether or not the email exists.
  - In `dev-server.log`, copy the `/reset-password?token=...` link and open it. Set a new password. Sign in with the new one.
- [ ] **Log out:** click **Log out** (or **Sign off**). You should be signed out and see the public homepage.

---

## 3. Buyer: signed in as demo-buyer-1 (M2 to M5)

Sign in as **demo-buyer-1@example.com** / **Demo-Buyer-Pass-1**.

- [ ] **Buyer dashboard** (`/buyer`): you should see sections for wishlist, enquiries, conversations, valuations and reports.
- [ ] **Wishlist** (`/buyer/wishlist`): open a gemstone, click **Save to wishlist**. The button should change to **Saved**. The item should appear on this page. Click **Saved** to remove it.
- [ ] **Enquiry:** open a gemstone from a seller. Click **Chat / Enquire**. Type a question in the box, for example "Is this still available?", and click **Send enquiry**.
  - You should be taken to the conversation page.
  - Try typing a phone number, for example `+91 98765 43210`. It should be hidden or refused, not sent in full. This protects the platform rule that contact stays on the site.
- [ ] **Conversations** (`/conversations`): open one. Type a reply and click **Send**. Your message should appear.
- [ ] **Quotation:** open a conversation where the seller has sent a quotation. You should see the price, quantity and validity. Click **Accept**. The status should show **Accepted**.
- [ ] **Requirements** (`/buyer/requirements/new`): fill in the requirement form and click **Post requirement**. You should land on the requirement page. Sellers can then respond.
- [ ] **Valuation** (M4):
  - Open a gemstone and click **Request valuation**, or go to `/valuation`.
  - Click **Start a valuation**.
  - Step 1: upload photos (JPEG, PNG or WebP). Use **Upload**.
  - Step 2: fill in the stone details and click **Continue**.
  - Step 3: click **Submit for valuation**. You should see the result page with a reference number.
  - Open `/buyer/valuations`. Your valuation should be listed with its status.
- [ ] **Reports** (`/buyer/reports`): saved reports appear here after a valuation is complete.
- [ ] **Notifications** (`/notifications`): you should see messages about enquiries and quotations. Open `/notifications/preferences` and change one setting. Save it.
- [ ] **Follow a seller:** open a seller profile and click **Follow seller**. The button should change to **Following**. Click it again to unfollow.
- [ ] **Newsletter topics** (account settings, M6): go to `/account`. Open the newsletter section. Change a topic and click **Save my topics**. The change should stay after a refresh. Then click **Unsubscribe from everything**. You should see "You have been unsubscribed". Sign up again later if you want to keep testing.
- [ ] **Phone:** repeat the enquiry and the wishlist on a phone-sized window (see "Phone" below). Nothing should scroll sideways.

---

## 4. Seller: signed in as himalaya-gem-house (Premium) (M2, M3, M5)

Sign in as **himalaya-gem-house@demo.gemstone.local** with **Demo-Seller-Pass-1**.

- [ ] **Seller dashboard** (`/seller`): you should see your status (approved), your tier, and quick links to listings, inbox and analytics.
- [ ] **Portfolio** (`/seller/portfolio`):
  - Change the **Tagline** and **About** text. Click **Save portfolio**. You should see "Portfolio saved."
  - Type a phone number or an email in **About**. You should see "Contact details are not allowed here." and nothing should be saved.
  - **Logo:** click the **Logo** field and choose a JPEG photo under 15 MB. Click **Save portfolio**. You should see "Portfolio saved." Open `/sellers/himalaya-gem-house`. The logo should show.
  - **Banner:** repeat with a PNG photo for the **Banner** field. The banner should show on the public profile.
  - **Too large:** choose a photo bigger than 15 MB. You should see "This photo is larger than 15 MB..." under the field.
  - **iPhone HEIC:** choose a `.HEIC` file. You should see a message that HEIC photos must be converted to JPEG first. The hint under the field should list JPEG, PNG or WebP, up to 15 MB.
- [ ] **Listings** (`/seller/listings`): open a listing and click **Edit**.
  - Change the title and click **Save changes**. You should see it saved.
  - Click **Save draft** on a new listing (`/seller/listings/new`). It should be kept as a draft.
  - Add a photo with **Add images or videos**. JPEG, PNG and WebP photos are accepted; HEIC is refused with the conversion message.
  - Click **Submit for review**. The listing should show **Awaiting review**.
- [ ] **Inventory** (`/seller/inventory`): you should see your stones with their status.
- [ ] **Inbox** (`/seller/inbox?side=selling`): open a conversation from a buyer. Type a reply in **Your reply** and click **Send reply**. Your reply should appear.
  - Click **Send a quotation**. Fill in **Item**, **Quantity**, **Price**, **Valid until** and **Terms**. Click **Send quotation**. The quotation should appear in the conversation.
- [ ] **Requirements** (`/seller/requirements`): open a buyer requirement, click **View and respond**, write a response and click **Send response**.
- [ ] **Quotations** (`/seller/quotations`): you should see the quotations you sent and their status.
- [ ] **Valuations** (`/seller/valuations`): open a valuation for one of your listings. If the report is complete, click **Publish on my listing**. It should show on the listing with the label "Platform indicative valuation – not a certified appraisal". Click **Make private** to remove it.
- [ ] **Analytics** (`/seller/analytics`): switch between **7 days**, **30 days** and **90 days**. Charts and tiles should update. Click the CSV export if your tier allows it (Premium shows it as locked, Elite can export).
- [ ] **Membership** (`/seller/membership`): you should see your tier, progress bars toward the next tier, a benefits table, and buttons **Upgrade** and **Rewards** marked "Coming soon". Your referral link should be shown.
- [ ] **Listing limit (Free seller):** sign in as **malabar-precious-gems@demo.gemstone.local** (Free). Try to publish one more listing than the limit (25). You should see a message that the limit has been reached and how to archive a listing.
- [ ] **Newsletter** (M6): the same account settings as the buyer (`/account`).
- [ ] **Phone:** open the portfolio and a listing on a phone-sized window. The photo upload buttons should work with the phone's file picker.

---

## 5. Pending seller: signed in as pending-seller@example.com (M1)

Sign in as **pending-seller@example.com** / **Pending-Seller-Pass-1**.

- [ ] **Dashboard** (`/seller`): you should see a notice that your application is waiting for approval. You should not see the publish buttons working.
- [ ] **Listings:** you should not be able to publish a listing. The page should say the account is not approved yet.
- [ ] **Portfolio** (`/seller/portfolio`): the form should not save changes for a pending seller.
- [ ] **Public profile:** this seller does not appear in `/sellers`. Open `/sellers/pending-gem-traders` while signed out. It should show "not found".
- [ ] Now sign in as **admin** (next section) and approve this seller. Then sign in as **pending-seller** again. The dashboard should now show the approved state.

### Apply as a new seller (M1)

Sign out. Open `/register/seller` in a private window.

- [ ] Fill in the business form: business name, business type, address, city, state, country, and categories.
- [ ] **Upload document** for the ID proof and the business proof. Use a PDF, JPEG or PNG under 10 MB.
- [ ] Click **Submit application**. You should see a message that the application is waiting for review.
- [ ] Check `dev-server.log` for the email to the new seller.

---

## 6. Admin: signed in as admin@gemstone.local (M1 to M6)

Sign in as **admin@gemstone.local** / **ChangeMe-Local-1**. Use the admin menu in the header.

- [ ] **Dashboard** (`/admin`): you should see counts for pending sellers, listings to review, documents, reports, enquiries and valuations.
- [ ] **Seller applications** (`/admin/sellers?status=PENDING`):
  - Open a pending seller and read the documents.
  - Click **Approve seller**. The seller should move to approved. Check `dev-server.log` for the approval email.
  - To test rejection, open another pending application, enter a reason and reject it.
- [ ] **Listing queue** (`/admin/listings`): open a listing waiting for review. Click **Approve listing**. It should appear in `/gemstones`.
  - Try to approve a listing from a Free seller who is at the limit. You should see a message that the seller is at the active listing limit.
- [ ] **All listings** (`/admin/listings/all`): filter by status. Click **Feature** on one listing and check it appears in the featured row on the homepage.
- [ ] **Documents** (`/admin/documents`): open a document and click **Verify document**. The verification badge should show on the product page.
- [ ] **Reviews** (`/admin/reviews`): hide one review and check it is hidden on the seller profile.
- [ ] **Flagged messages** (`/admin/moderation`): open a flagged message. You should see the masked text and the sender. Click **Clear flag** on one that is fine.
- [ ] **Reports** (`/admin/reports`): open a report and resolve it.
- [ ] **Requirements** (`/admin/requirements`): see requirements posted by buyers.
- [ ] **Homepage** (`/admin/homepage`): change a block and check it on the homepage.
- [ ] **Valuations** (`/admin/valuations`):
  - Open a valuation. Use **Save assignment** to assign it to the valuator demo.valuer@example.test.
  - Open `/admin/valuations/prices`. You should see reference prices labelled demo.
  - Open `/admin/valuations/stats`.
- [ ] **Memberships** (`/admin/memberships`): find **himalaya-gem-house** (Premium). Click **Set tier**, choose a tier, enter a reason and save. The change should be recorded with the reason.
  - Click **Clear override**. The seller returns to their earned tier.
  - Open `/admin/memberships/rules`, change one number and click **Save tier rules**. Change it back.
- [ ] **Referrals** (`/admin/referrals`): find a flagged referral and click **Clear flag** or **Void referral**.
- [ ] **Analytics** (`/admin/analytics`): switch between 7, 30 and 90 days. Charts should load. Export CSV.
- [ ] **Content** (`/admin/content`) (M6):
  - Click **Create draft** or open `/admin/content/new`.
  - Fill in **Title** and **Summary**. Write Markdown in the body. The live preview should update.
  - Try to type `<script>alert(1)</script>` in the body. It should appear as text and never run.
  - Click **Save draft**. Then **Schedule** with a time 5 minutes in the future. The item should show as scheduled and not appear on `/education` yet.
  - Click **Publish now** on another article. It should appear on `/education` straight away.
  - For a news item, leave **Source name** empty and try to publish. You should see that a source is required.
- [ ] **Newsletter** (`/admin/newsletter`) (M6):
  - Open **Campaigns** and click **New campaign** (or `/admin/newsletter/campaigns/new`).
  - Fill in **Subject**, a short body and tick a topic.
  - Click **Send test**. Check `dev-server.log` for `[email:console] to=admin@gemstone.local` with the subject "[Test] ...".
  - Click **Schedule** with a future time, or cancel it again.
  - Open the subscribers list. No IP addresses should be shown.
- [ ] **Settings** (`/admin/settings`): toggle **auto-publish** on and off and check the setting changes.
- [ ] **Audit log:** the admin pages record approvals, overrides and content changes. Check the audit entries if the page is available.

---

## 7. Valuator: signed in as demo.valuer@example.test (M4)

Sign in as **demo.valuer@example.test** / **demo-valuer-dev-only-change-me**.

- [ ] **Queue** (`/valuator/queue`): you should see only valuations assigned to you.
- [ ] Open an assigned valuation. You should see the photos and stone details.
- [ ] You should **not** see the requester's name, email or phone. The valuator contacts the requester through the question thread only.
- [ ] Add your expert notes and submit the result. The status should change.
- [ ] Try to open a valuation not assigned to you. You should see "not found" or "access denied".

---

## 8. Phone (390 px wide)

Repeat the main pages on a phone (or in the browser's phone view: press F12, then the phone icon, and choose a width of 390 px).

- [ ] Homepage, catalogue and product page: no sideways scrolling.
- [ ] Sign-in and sign-up forms: fields and buttons are big enough to tap.
- [ ] Photo upload on a phone opens the phone's file picker.
- [ ] Admin tables scroll inside the page, not the whole page.
- [ ] Education and news articles are easy to read.

---

## Bugs found

Write one row per problem. Include the screenshot name if you took one (for example `buyer-enquiry-390.png`).

| # | Page | What I did | What happened | What I expected | Screenshot |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
