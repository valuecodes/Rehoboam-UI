type PrivacySection = Readonly<{
  body: readonly string[];
  title: string;
}>;

const privacySections: readonly PrivacySection[] = [
  {
    title: "What this app displays",
    body: [
      "This interface presents a stylized Rehoboam-inspired event timeline and related system overlays for product visualization and monitoring.",
      "The displayed items may include event titles, timestamps, locations, and diagnostic render information when the HUD view is enabled.",
    ],
  },
  {
    title: "Data sources",
    body: [
      "The scene requests event data from the app API endpoint and renders the returned dataset inside the timeline experience.",
      "Data shown here should be treated as application content, not as legal, safety, or operational advice.",
    ],
  },
  {
    title: "Local storage and caching",
    body: [
      "To improve load speed, the UI may cache event data in local browser storage and reuse that cache during startup before refreshing in the background.",
      "Cached content is intended to accelerate boot performance and may briefly appear before newer network data arrives.",
    ],
  },
  {
    title: "Analytics",
    body: [
      "This app includes Cloudflare Web Analytics for aggregate usage measurement, performance visibility, and traffic monitoring.",
      "Analytics data is intended to help evaluate reliability and usage trends. Final disclosure language should be reviewed before production launch.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For policy updates, data handling questions, or formal contact details, replace this provisional section with your organization’s approved legal and support information.",
    ],
  },
];

export const PrivacyPolicyView = () => {
  return (
    <section
      aria-labelledby="privacy-policy-title"
      className="privacy-policy-view"
    >
      <article className="privacy-policy-view__panel">
        <p className="privacy-policy-view__eyebrow">Policy reference</p>
        <h1 className="privacy-policy-view__title" id="privacy-policy-title">
          Privacy Policy
        </h1>
        <p className="privacy-policy-view__intro">
          This is provisional policy copy for the first navigation release. It
          establishes the right structure and disclosure areas, but legal review
          is still required before publishing final terms.
        </p>
        {privacySections.map((section) => {
          return (
            <section className="privacy-policy-view__section" key={section.title}>
              <h2 className="privacy-policy-view__section-title">
                {section.title}
              </h2>
              {section.body.map((paragraph) => {
                return (
                  <p className="privacy-policy-view__paragraph" key={paragraph}>
                    {paragraph}
                  </p>
                );
              })}
            </section>
          );
        })}
      </article>
    </section>
  );
};
