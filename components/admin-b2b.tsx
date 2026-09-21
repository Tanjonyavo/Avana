import { businessLeads } from "@/data/demo";

const stages = ["Nouveau lead", "Contacté", "Échantillon", "Discussion", "Proposition", "Négociation"];

export function AdminB2B() {
  const leads = businessLeads;
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">CRM professionnel</span>
          <h1>Pipeline B2B</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">Données de démonstration</span>
          <button className="button button-dark button-sm" disabled>
            Ajouter un lead
          </button>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Leads actifs</span>
          </div>
          <strong>{leads.filter((lead) => !["Client", "Perdu"].includes(lead.stage)).length}</strong>
          <small>Pipeline actuel</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Valeur pondérée</span>
          </div>
          <strong>8 640 $</strong>
          <small>Hypothèse</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Échantillons</span>
          </div>
          <strong>{leads.filter((lead) => lead.stage === "Échantillon").length}</strong>
          <small>En suivi</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Taux de qualification</span>
          </div>
          <strong>62 %</strong>
          <small>Donnée démo</small>
        </div>
      </div>
      <section className="admin-section">
        <div className="pipeline">
          {stages.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage);
            return (
              <div className="pipeline-column" key={stage}>
                <div className="pipeline-title">
                  <span>{stage}</span>
                  <span className="pipeline-count">{stageLeads.length}</span>
                </div>
                {stageLeads.map((lead) => (
                  <article className="lead-card" key={lead.id}>
                    <strong>{lead.company}</strong>
                    <span>
                      {lead.contact} · {lead.segment}
                    </span>
                    <div className="lead-card-meta">
                      <span>
                        {lead.product} · {lead.volume}
                      </span>
                      <strong>
                        {lead.value ? `${lead.value.toLocaleString("fr-CA")} $` : "À qualifier"}
                      </strong>
                    </div>
                    <p style={{ margin: ".6rem 0 0", fontSize: ".68rem", color: "#776a61" }}>
                      {lead.nextAction}
                    </p>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
