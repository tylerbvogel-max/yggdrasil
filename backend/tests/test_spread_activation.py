"""Tests for spreading activation via NeuronEdge graph."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.scoring_engine import NeuronScoreBreakdown
from app.services.neuron_service import spread_activation


def _score(neuron_id: int, combined: float, spread_boost: float = 0.0) -> NeuronScoreBreakdown:
    """Helper to create a NeuronScoreBreakdown with minimal fields."""
    return NeuronScoreBreakdown(
        neuron_id=neuron_id,
        burst=0.1, impact=0.2, precision=0.1, novelty=0.1,
        recency=0.2, relevance=0.1,
        combined=combined, spread_boost=spread_boost,
    )


def _edge(source_id: int, target_id: int, weight: float, co_fire_count: int = 5, edge_type: str = "pyramidal"):
    """Helper to create a mock NeuronEdge."""
    edge = MagicMock()
    edge.source_id = source_id
    edge.target_id = target_id
    edge.weight = weight
    edge.co_fire_count = co_fire_count
    edge.edge_type = edge_type
    return edge


def _mock_db(edges: list, active_ids: set | None = None):
    """Create a mock AsyncSession that returns edges and active neuron checks."""
    db = AsyncMock()
    call_count = 0

    async def mock_execute(stmt):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            # Edge query
            result.scalars.return_value.all.return_value = edges
        else:
            # Active neuron check
            ids = active_ids if active_ids is not None else {e.source_id for e in edges} | {e.target_id for e in edges}
            result.all.return_value = [(nid,) for nid in ids]
        return result

    db.execute = mock_execute
    return db


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_spread_disabled_passthrough(mock_settings):
    """spread_enabled=False → passthrough."""
    mock_settings.spread_enabled = False
    scored = [_score(1, 0.9), _score(2, 0.8)]
    result = await spread_activation(AsyncMock(), scored, 2)
    assert result == scored


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_no_qualifying_edges_passthrough(mock_settings):
    """No qualifying edges → passthrough."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_max_hops = 3
    db = _mock_db(edges=[])
    scored = [_score(1, 0.9), _score(2, 0.8)]
    result = await spread_activation(db, scored, 2)
    assert result == scored


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_below_threshold_activation_excluded(mock_settings):
    """Below-threshold activation → excluded."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    # source score 0.3, edge weight 0.2, decay 0.5 → activation = 0.03 (below 0.15)
    edges = [_edge(1, 100, weight=0.2)]
    db = _mock_db(edges, active_ids={100})
    scored = [_score(1, 0.3), _score(2, 0.25)]
    result = await spread_activation(db, scored, 2)
    # No promotions since activation too low
    assert len(result) == 2
    assert result[0].neuron_id == 1


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_above_threshold_neighbor_displaces_lowest(mock_settings):
    """Above-threshold neighbor displaces lowest top-K."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    # source score 0.9, edge weight 0.8, decay 0.5 → activation = 0.36
    edges = [_edge(1, 100, weight=0.8)]
    db = _mock_db(edges, active_ids={100})
    scored = [_score(1, 0.9), _score(2, 0.2)]  # top-K = 2
    result = await spread_activation(db, scored, 2)
    top_k_ids = {s.neuron_id for s in result[:2]}
    assert 100 in top_k_ids  # neighbor promoted
    assert 2 not in top_k_ids  # lowest displaced


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_below_cutoff_neuron_gets_additive_boost(mock_settings):
    """Below-cutoff neuron gets additive boost."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    # Neuron 3 is below cutoff (top_k=2). Edge from 1→3 with activation = 0.9*0.8*0.5 = 0.36
    edges = [_edge(1, 3, weight=0.8)]
    db = _mock_db(edges, active_ids={3})
    scored = [_score(1, 0.9), _score(2, 0.5), _score(3, 0.1)]
    result = await spread_activation(db, scored, 2)

    # Neuron 3 should have been boosted: 0.1 + 0.36 = 0.46
    neuron_3 = next(s for s in result if s.neuron_id == 3)
    assert neuron_3.spread_boost == 0.36
    assert abs(neuron_3.combined - 0.46) < 0.01


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_spread_max_neurons_cap(mock_settings):
    """spread_max_neurons cap respected."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 2

    # 4 qualifying neighbors, but cap at 2
    edges = [
        _edge(1, 100, weight=0.8),
        _edge(1, 101, weight=0.7),
        _edge(1, 102, weight=0.6),
        _edge(1, 103, weight=0.5),
    ]
    db = _mock_db(edges, active_ids={100, 101, 102, 103})
    scored = [_score(1, 0.9), _score(2, 0.5), _score(3, 0.4)]
    result = await spread_activation(db, scored, 3)

    # Only 2 neighbors should have been promoted
    promoted = [s for s in result if s.spread_boost > 0]
    assert len(promoted) <= 2


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_both_in_top_k_edges_skipped(mock_settings):
    """Both-in-top-K edges skipped (no self-reinforcement)."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    # Edge between neurons 1 and 2, both in top-K → should be skipped
    edges = [_edge(1, 2, weight=0.9)]
    db = _mock_db(edges, active_ids={1, 2})
    scored = [_score(1, 0.9), _score(2, 0.8)]
    result = await spread_activation(db, scored, 2)

    # No promotions — both in top-K
    promoted = [s for s in result if s.spread_boost > 0]
    assert len(promoted) == 0


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_inactive_neurons_filtered(mock_settings):
    """Inactive neurons filtered."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    edges = [_edge(1, 100, weight=0.8)]
    # 100 is NOT in active_ids
    db = _mock_db(edges, active_ids=set())
    scored = [_score(1, 0.9), _score(2, 0.5)]
    result = await spread_activation(db, scored, 2)

    promoted = [s for s in result if s.spread_boost > 0]
    assert len(promoted) == 0


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_unscored_neighbor_gets_pure_activation(mock_settings):
    """Unscored neighbor gets pure activation entry."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    # Neuron 100 was never in candidates
    edges = [_edge(1, 100, weight=0.8)]
    db = _mock_db(edges, active_ids={100})
    scored = [_score(1, 0.9), _score(2, 0.2)]
    result = await spread_activation(db, scored, 2)

    neuron_100 = next((s for s in result if s.neuron_id == 100), None)
    assert neuron_100 is not None
    # Pure activation: 0.9 * 0.8 * 0.5 = 0.36
    assert neuron_100.spread_boost == 0.36
    assert neuron_100.combined == 0.36
    assert neuron_100.burst == 0.0
    assert neuron_100.impact == 0.0


@pytest.mark.asyncio
@patch("app.services.neuron_service.settings")
async def test_multiple_edges_to_same_neighbor_max_wins(mock_settings):
    """Multiple edges to same neighbor → max wins."""
    mock_settings.spread_enabled = True
    mock_settings.spread_min_edge_weight = 0.15
    mock_settings.spread_decay = 0.5
    mock_settings.spread_min_activation = 0.15
    mock_settings.spread_stellate_decay = 0.3
    mock_settings.spread_pyramidal_min_weight = 0.20
    mock_settings.spread_max_hops = 3
    mock_settings.spread_max_neurons = 10

    # Two edges to neuron 100: from 1 (activation=0.9*0.8*0.5=0.36) and from 2 (0.5*0.6*0.5=0.15)
    edges = [_edge(1, 100, weight=0.8), _edge(2, 100, weight=0.6)]
    db = _mock_db(edges, active_ids={100})
    scored = [_score(1, 0.9), _score(2, 0.5)]
    result = await spread_activation(db, scored, 2)

    neuron_100 = next((s for s in result if s.neuron_id == 100), None)
    assert neuron_100 is not None
    # Max of 0.36 and 0.15 = 0.36
    assert neuron_100.spread_boost == 0.36
