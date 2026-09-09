from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_replay_panel_shows_skill_provenance_index() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "SkillProvenancePanel" in replay_panel
    assert "useApi<any>('/replay/skills'" in replay_panel
    assert "success_rate" in replay_panel
    assert "hash {skill.hash || 'unavailable'}" in replay_panel
    assert "first {formatDate(skill.first_used_at)}" in replay_panel
    assert "mutation receipts {(skill.mutation_receipts || []).length}" in replay_panel


def test_replay_panel_has_prd_list_filters_and_columns() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "RUN_FILTERS" in replay_panel
    assert "Successful" in replay_panel
    assert "Failed" in replay_panel
    assert "Has tools" in replay_panel
    assert "File changes" in replay_panel
    assert "High cost" in replay_panel
    assert "runMatchesFilter(run, filter)" in replay_panel
    assert "run.counts.files_changed" in replay_panel
    assert "run.redaction_status.replaceAll" in replay_panel


def test_replay_detail_has_proof_score_and_timeline_metadata() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "function ProofScoreCard" in replay_panel
    assert "proofScore(detail)" in replay_panel
    assert "local hashes" in replay_panel
    assert "Status: {event.status}" in replay_panel
    assert "Redaction: {event.redacted_content ? 'redacted' : 'summary only'}" in replay_panel
    assert "{compactTime(event.timestamp)}" in replay_panel


def test_replay_detail_has_collapsed_raw_trace_toggle() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "function RawTracePanel" in replay_panel
    assert "Show normalized trace" in replay_panel
    assert "Hide normalized trace" in replay_panel
    assert "<RawTracePanel detail={detail} />" in replay_panel


def test_replay_detail_has_share_card_preview() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "function ShareCardPreview" in replay_panel
    assert "Hermes Replay" in replay_panel
    assert "Replay hash: {run.hashes.redacted_replay_hash || 'Pending'}" in replay_panel
    assert "<ShareCardPreview detail={detail} />" in replay_panel


def test_replay_panel_shows_local_gallery_index() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "function ReplayGalleryPanel" in replay_panel
    assert "useApi<any>('/replay/gallery'" in replay_panel
    assert "Published Gallery" in replay_panel
    assert "Static index: {galleryPath}" in replay_panel
    assert "views {entry.view_count || 0} · forks {entry.fork_count || 0}" in replay_panel


def test_replay_settings_warn_before_raw_logs_or_screenshots() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "Raw logs and screenshots can expose private prompts" in replay_panel
    assert "Safe Share Mode remains on for default exports" in replay_panel


def test_proof_artifacts_panel_has_type_filters() -> None:
    replay_panel = (ROOT / "frontend/src/components/ReplayPanel.tsx").read_text()

    assert "const [filter, setFilter] = useState('all')" in replay_panel
    assert "visibleArtifacts" in replay_panel
    assert "type.replaceAll('_', ' ')" in replay_panel
