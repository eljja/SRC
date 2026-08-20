/**
 * Tracker Module
 * Calculates data freshness by comparing the dataset update timestamp with the client's current date.
 * Provides update recommendation status and data export/import capabilities.
 */
class Tracker {
  constructor(metadata) {
    this.metadata = metadata || { last_updated: '2026-08-20' };
    this.clientDate = new Date();
  }

  calculateFreshness() {
    const lastUpdatedStr = this.metadata && this.metadata.last_updated ? this.metadata.last_updated : this.formatDate(new Date());
    const lastUpdateDate = new Date(lastUpdatedStr);
    
    let diffDays = 0;
    if (!isNaN(lastUpdateDate.getTime())) {
      const diffTime = this.clientDate.getTime() - lastUpdateDate.getTime();
      diffDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
    }

    let status = 'fresh';
    let statusText = '최신 상태 (Fresh)';
    let recommendation = '데이터가 최신 연구 동향을 반영하고 있습니다.';

    if (diffDays > 90) {
      status = 'stale';
      statusText = '업데이트 필요 (Needs Update)';
      recommendation = `데이터가 ${diffDays}일 전에 업데이트되었습니다. 최신 학회(IEDM/VLSI) 및 펀딩 공시 반영이 권장됩니다.`;
    } else if (diffDays > 30) {
      status = 'moderate';
      statusText = '확인 권장 (Review Suggested)';
      recommendation = `마지막 업데이트 후 약 ${diffDays}일이 경과했습니다.`;
    }

    return {
      lastUpdatedStr,
      clientDateStr: this.formatDate(this.clientDate),
      diffDays,
      status,
      statusText,
      recommendation
    };
  }

  formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  renderHeaderBadge(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const freshness = this.calculateFreshness();

    container.innerHTML = `
      <div class="freshness-tracker-badge" title="${freshness.recommendation}">
        <span class="freshness-indicator ${freshness.status}"></span>
        <div class="meta-date-info">
          <span>DB 갱신: <strong>${freshness.lastUpdatedStr}</strong></span>
          <span style="opacity: 0.4;">|</span>
          <span>접속일: <strong>${freshness.clientDateStr}</strong></span>
          <span style="opacity: 0.4;">|</span>
          <span style="color: ${freshness.status === 'fresh' ? '#34d399' : (freshness.status === 'moderate' ? '#fbbf24' : '#f43f5e')}">
            ${freshness.statusText}
          </span>
        </div>
      </div>
    `;

    // If data is stale (>90 days), show optional floating banner
    if (freshness.status === 'stale') {
      this.renderFreshnessAlert(freshness);
    }
  }

  renderFreshnessAlert(freshness) {
    const existing = document.getElementById('freshness-alert-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'freshness-alert-banner';
    banner.className = 'freshness-alert-banner';
    banner.innerHTML = `
      <span>🔔 <strong>데이터 업데이트 알림:</strong> ${freshness.recommendation} (마지막 업데이트: ${freshness.lastUpdatedStr})</span>
      <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; cursor:pointer; font-weight:bold;">✕</button>
    `;
    document.body.appendChild(banner);
  }
}

window.Tracker = Tracker;
