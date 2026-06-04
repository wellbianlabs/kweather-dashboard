"""ORM 모델.

PRD 4장 스키마(devices, sensor_logs)를 따르며, 6.3장 멀티테넌트 격리를 위해
tenants 테이블과 tenant_id 외래키를 추가합니다.
NUMERIC(4,1) 등 PostgreSQL 타입은 SQLite 에서도 호환되도록 Numeric/Float 로 표현합니다.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Index,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Tenant(Base):
    """클라이언트(회사) 계정 — 데이터 격리 단위."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    api_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    devices: Mapped[list["Device"]] = relationship(back_populates="tenant")


class Device(Base):
    """기기 및 사업장 메타데이터 (PRD 4.1)."""

    __tablename__ = "devices"

    device_sn: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_name: Mapped[str | None] = mapped_column(String(200))
    location_name: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(300))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    region_code: Mapped[str | None] = mapped_column(String(40))  # 기상청 지역/격자 코드

    tenant: Mapped["Tenant"] = relationship(back_populates="devices")
    logs: Mapped[list["SensorLog"]] = relationship(
        back_populates="device", cascade="all, delete-orphan"
    )


class SensorLog(Base):
    """시계열 센서 데이터 (PRD 4.2)."""

    __tablename__ = "sensor_logs"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    device_sn: Mapped[str] = mapped_column(
        ForeignKey("devices.device_sn", ondelete="CASCADE"), nullable=False
    )
    # KST(naive) 기준. DATE + TIME 결합값.
    measured_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    temperature: Mapped[float] = mapped_column(Numeric(4, 1))
    humidity: Mapped[int | None] = mapped_column(Integer)
    feels_like_temperature: Mapped[float] = mapped_column(Numeric(4, 1))

    device: Mapped["Device"] = relationship(back_populates="logs")

    __table_args__ = (
        # (device_sn, measured_at) 유니크 -> 중복 업로드 시 Upsert 기준
        UniqueConstraint("device_sn", "measured_at", name="uq_device_measured"),
        Index("ix_sensorlog_device_time", "device_sn", "measured_at"),
    )
