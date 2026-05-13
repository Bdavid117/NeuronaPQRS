from __future__ import annotations

from datetime import date

from pae_api.services.tracking import add_business_days, calcular_plazo, plazo_label


def test_add_business_days_skips_weekends():
    friday = date(2026, 5, 1)  # Friday
    result = add_business_days(friday, 3)
    # Should be Wed May 6 (skip Sat/Sun)
    assert result == date(2026, 5, 6)


def test_calcular_plazo_peticion():
    plazo = calcular_plazo("peticion")
    today = date.today()
    assert (plazo - today).days >= 15


def test_plazo_label_contains_dias():
    label = plazo_label("reclamo")
    assert "días hábiles" in label
