export const PrivacyPolicyView = () => {
  return (
    <section
      aria-labelledby="privacy-policy-title"
      className="privacy-policy-view"
    >
      <article className="privacy-policy-view__panel">
        <h1 className="privacy-policy-view__title" id="privacy-policy-title">
          Rehoboam UI Privacy Policy
        </h1>
        <p className="privacy-policy-view__intro">
          Last updated: March 5, 2026. This privacy policy explains how the
          Rehoboam UI app at{" "}
          <a
            href="https://rehoboam.valuecodes.fi/"
            target="_blank"
            rel="noopener noreferrer"
          >
            rehoboam.valuecodes.fi
          </a>{" "}
          processes personal
          data when you use the site. Rehoboam UI is a read-only web
          application. It does not offer user accounts, checkout, newsletters,
          or contact forms. We do not ask you to submit your name, email
          address, or other directly identifying information through the app.
        </p>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Data Controller
          </h2>
          <p className="privacy-policy-view__paragraph">
            Controller: Rehoboam UI operator
            <br />
            Contact email:{" "}
            <a href="mailto:privacy@valuecodes.fi">privacy@valuecodes.fi</a>
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            What Data We Process
          </h2>
          <p className="privacy-policy-view__paragraph">
            When you visit the app, the following categories of data can be
            processed:
          </p>
          <ol className="privacy-policy-view__list">
            <li>
              Technical request data handled by the hosting and security layer,
              including your IP address, browser and device metadata, request
              timestamps, requested URLs, referrer information, and similar
              network-level data.
            </li>
            <li>
              Aggregate or sampled usage and performance telemetry processed
              through Cloudflare Web Analytics, such as page views, page load
              timing, performance metrics, and general browser or network
              characteristics.
            </li>
            <li>
              Security challenge data if Cloudflare applies bot or abuse
              protection.
            </li>
          </ol>
          <p className="privacy-policy-view__paragraph">
            We do not use the app to collect special-category personal data,
            payment data, or account credentials.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            How We Collect Data
          </h2>
          <p className="privacy-policy-view__paragraph">
            We collect or receive data when:
          </p>
          <ol className="privacy-policy-view__list">
            <li>Your browser requests pages and assets from the app.</li>
            <li>
              Cloudflare provides hosting, traffic filtering, and analytics
              services for the site.
            </li>
          </ol>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            How We Use Data
          </h2>
          <p className="privacy-policy-view__paragraph">
            We process limited technical data to:
          </p>
          <ol className="privacy-policy-view__list">
            <li>Deliver the website and its content to your device.</li>
            <li>
              Protect the service against malicious traffic, abuse, and
              automated attacks.
            </li>
            <li>Measure site reliability, traffic volume, and performance.</li>
            <li>
              Diagnose errors and improve the speed and stability of the app.
            </li>
          </ol>
          <p className="privacy-policy-view__paragraph">
            We do not use the app for behavioral advertising, user profiling, or
            direct marketing.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">Legal Bases</h2>
          <p className="privacy-policy-view__paragraph">
            Where the GDPR applies, our legal basis for the processing described
            above is legitimate interests under Article 6(1)(f) GDPR. Our
            legitimate interests include secure delivery of the site, abuse
            prevention, service monitoring, performance improvement, and
            privacy-friendly analytics. We have assessed that this processing
            does not override your rights and freedoms given the limited and
            non-identifying nature of the data involved.
          </p>
          <p className="privacy-policy-view__paragraph">
            The app does not rely on consent for newsletters, marketing, or
            account-based personalization because those features are not
            offered.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Cookies and Similar Technologies
          </h2>
          <p className="privacy-policy-view__paragraph">
            The app does not use advertising cookies.
          </p>
          <p className="privacy-policy-view__paragraph">
            Cloudflare may set strictly necessary security cookies (such as
            cf_clearance) when its security features are triggered or enabled.
            These cookies are used for security purposes only, such as
            remembering that a challenge was completed successfully.
          </p>
          <p className="privacy-policy-view__paragraph">
            Cloudflare Web Analytics is used for privacy-focused traffic
            measurement. It does not use cookies or local storage for analytics,
            and is designed to provide aggregate insights without tracking
            individual users over time. The app operator uses it for aggregate
            reporting and not to identify individual visitors.
          </p>
          <p className="privacy-policy-view__paragraph">
            You can clear any cookies for this site through your browser
            settings.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Who Receives Data
          </h2>
          <p className="privacy-policy-view__paragraph">
            Data can be received by:
          </p>
          <ol className="privacy-policy-view__list">
            <li>The Rehoboam UI operator.</li>
            <li>
              Cloudflare, which provides hosting, content delivery, security
              filtering, and analytics services for the app.
            </li>
          </ol>
          <p className="privacy-policy-view__paragraph">
            We do not sell personal data. We do not share visitor data for
            third-party advertising.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            International Transfers
          </h2>
          <p className="privacy-policy-view__paragraph">
            Cloudflare operates a global network. As a result, limited technical
            data related to requests, security, and analytics can be processed
            in countries outside your home country, including outside the EEA.
          </p>
          <p className="privacy-policy-view__paragraph">
            Where transfers occur outside the EEA, we rely on safeguards such as
            the EU Standard Contractual Clauses (SCCs) as reflected in
            Cloudflare&rsquo;s customer Data Processing Addendum (DPA).
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">Retention</h2>
          <p className="privacy-policy-view__paragraph">
            We keep data only for as long as needed for the purposes described
            above:
          </p>
          <p className="privacy-policy-view__paragraph">
            Web Analytics reports are available for up to 6 months in the
            Cloudflare dashboard. Security and event logs are retained according
            to the Cloudflare service tier and configuration in use for this
            app.
          </p>
          <p className="privacy-policy-view__paragraph">
            Because the app does not maintain user accounts, it does not keep a
            user profile or customer record for you.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Your Data Protection Rights
          </h2>
          <p className="privacy-policy-view__paragraph">
            If the GDPR applies to you, you may have the right to:
          </p>
          <ol className="privacy-policy-view__list">
            <li>Access the personal data processed about you.</li>
            <li>Request correction of inaccurate personal data.</li>
            <li>Request deletion of personal data, where applicable.</li>
            <li>Request restriction of processing, where applicable.</li>
            <li>
              Object to processing based on legitimate interests, where
              applicable.
            </li>
            <li>Request data portability, where applicable.</li>
            <li>Lodge a complaint with your local supervisory authority.</li>
          </ol>
          <p className="privacy-policy-view__paragraph">
            Because the app does not maintain an account system, rights requests
            generally must be handled based on technical request data held by
            service providers, if any.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Automated Decision-Making
          </h2>
          <p className="privacy-policy-view__paragraph">
            The app does not use automated decision-making or profiling to make
            decisions about you.
          </p>
          <p className="privacy-policy-view__paragraph">
            Cloudflare security systems can automatically evaluate requests for
            abuse prevention and can require a browser challenge before access
            is granted. This is used to protect the service, not to profile
            visitors for marketing or eligibility decisions.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            AI-Generated Content
          </h2>
          <p className="privacy-policy-view__paragraph">
            The events displayed in Rehoboam UI are sourced from third-party
            news feeds and processed using artificial intelligence. AI
            processing may introduce errors, omissions, or misrepresentations of
            the original source material.
          </p>
          <p className="privacy-policy-view__paragraph">
            Rehoboam UI is not a news service. The content shown is provided for
            informational and demonstration purposes only and should not be
            relied upon for decision-making. We do not guarantee the accuracy,
            completeness, or timeliness of any content displayed.
          </p>
          <p className="privacy-policy-view__paragraph">
            We are not responsible for the accuracy or reliability of
            third-party source content or for any consequences arising from
            reliance on AI-processed information presented in the app.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Links To Other Sites
          </h2>
          <p className="privacy-policy-view__paragraph">
            If the app links to other websites, this privacy policy applies only
            to Rehoboam UI. You should review the privacy policy of any external
            site you visit.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Changes To This Policy
          </h2>
          <p className="privacy-policy-view__paragraph">
            We will update this page when this privacy policy changes. Material
            changes will be reflected by updating the &ldquo;Last updated&rdquo;
            date at the top of this document.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">Contact</h2>
          <p className="privacy-policy-view__paragraph">
            For privacy questions or to exercise your rights, contact the
            controller using the contact details listed above.
          </p>
        </section>

        <section className="privacy-policy-view__section">
          <h2 className="privacy-policy-view__section-title">
            Supervisory Authority
          </h2>
          <p className="privacy-policy-view__paragraph">
            If you believe your data protection concern has not been handled
            properly, you can contact your local data protection authority in
            the EU/EEA or the authority in your place of residence.
          </p>
        </section>
      </article>
    </section>
  );
};
