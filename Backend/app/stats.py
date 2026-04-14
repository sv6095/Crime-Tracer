# app/routers/stats.py
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case

from .db import get_db
from . import models
from .deps import get_current_user

router = APIRouter()

@router.get("/dashboard")
def dashboard_stats(
    days: int = Query(30),
    station_id: Optional[str] = Query(None),
    scope: Optional[str] = Query("station"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Core dashboard stats.
    Scope: 'station' (default) or 'my' (for cop individual stats).
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Base Query
    q = db.query(models.Complaint).filter(models.Complaint.created_at >= cutoff)

    # Filter by permission & params
    if user.role == models.UserRole.COP:
        if scope == 'my':
            # Join Case to filter by assigned_officer_id
            q = q.join(models.Case, models.Case.complaint_id == models.Complaint.id)\
                 .filter(models.Case.assigned_officer_id == user.id)
        else:
            if user.station_id:
                q = q.filter(models.Complaint.station_id == user.station_id)
            
    elif user.role == models.UserRole.ADMIN:
        if station_id and station_id.lower() != "all":
            q = q.filter(models.Complaint.station_id == station_id)

    total_complaints = q.count()

    active_complaints = q.filter(
        models.Complaint.status.not_in([models.ComplaintStatus.CLOSED, models.ComplaintStatus.RESOLVED])
    ).count()

    closed_complaints = q.filter(
        models.Complaint.status.in_([models.ComplaintStatus.CLOSED, models.ComplaintStatus.RESOLVED])
    ).count()

    # Avg resolution
    avg_resolution_hours = 0.0
    try:
        closed_q = q.filter(
            models.Complaint.status.in_([models.ComplaintStatus.CLOSED, models.ComplaintStatus.RESOLVED]),
            models.Complaint.updated_at.isnot(None)
        )
        closed_with_times = closed_q.all()
        if closed_with_times:
            total_hours = 0
            count = 0
            for c in closed_with_times:
                if c.updated_at and c.created_at:
                    delta = c.updated_at - c.created_at
                    total_hours += delta.total_seconds() / 3600
                    count += 1
            if count > 0:
                avg_resolution_hours = round(total_hours / count, 1)
    except Exception:
        avg_resolution_hours = 0.0
    
    not_assigned_count = q.filter(models.Complaint.status == models.ComplaintStatus.NOT_ASSIGNED).count()
    investigating_count = q.filter(models.Complaint.status == models.ComplaintStatus.INVESTIGATING).count()
    resolved_count = q.filter(models.Complaint.status == models.ComplaintStatus.RESOLVED).count()
    closed_count = q.filter(models.Complaint.status == models.ComplaintStatus.CLOSED).count()
    rejected_count = q.filter(models.Complaint.status == models.ComplaintStatus.REJECTED).count()

    return {
        "total_complaints": total_complaints,
        "active_complaints": active_complaints,
        "closed_complaints": closed_complaints,
        "avg_resolution_hours": avg_resolution_hours,
        "status_counts": {
            "not_assigned": not_assigned_count,
            "investigating": investigating_count,
            "resolved": resolved_count,
            "closed": closed_count,
            "rejected": rejected_count
        }
    }


@router.get("/complaints/trends")
def complaint_trends(
    days: int = Query(30),
    station_id: Optional[str] = Query(None),
    scope: Optional[str] = Query("station"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Daily complaint trends.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    q = db.query(
        func.date(models.Complaint.created_at).label("date"),
        func.count(models.Complaint.id).label("total"),
        func.sum(
            case((models.Complaint.status.in_([models.ComplaintStatus.RESOLVED, models.ComplaintStatus.CLOSED]), 1), else_=0)
        ).label("resolved")
    ).filter(models.Complaint.created_at >= cutoff)

    if user.role == models.UserRole.COP:
        if scope == 'my':
             q = q.join(models.Case, models.Case.complaint_id == models.Complaint.id)\
                  .filter(models.Case.assigned_officer_id == user.id)
        elif user.station_id:
            q = q.filter(models.Complaint.station_id == user.station_id)
            
    elif user.role == models.UserRole.ADMIN:
        if station_id and station_id.lower() != "all":
            q = q.filter(models.Complaint.station_id == station_id)
        
    results = q.group_by("date").order_by("date").all()
    
    data = []
    for r in results:
        data.append({
            "date": r.date,
            "total": r.total,
            "resolved": r.resolved or 0,
            "open": r.total - (r.resolved or 0)
        })
        
    return {"daily": data}


@router.get("/stations/performance")
def station_performance(
    days: int = Query(30),
    station_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    q = db.query(
        models.Station.id.label("station_id"),
        models.Station.name.label("station_name"),
        func.count(models.Complaint.id).label("total"),
        func.sum(
             case((models.Complaint.status.in_([models.ComplaintStatus.RESOLVED, models.ComplaintStatus.CLOSED]), 1), else_=0)
        ).label("closed")
    ).join(models.Complaint, models.Complaint.station_id == models.Station.id) \
     .filter(models.Complaint.created_at >= cutoff)
     
    # Allow Cops to see OVERALL (all) performance, unless they specifically filter (which they can't in UI usually).
    # Previous logic enforced user.station_id. 
    # User requested: "keep only station performance which is overall".
    # So we REMOVE the forced Cop filter.
    
    if user.role == models.UserRole.ADMIN:
        if station_id and station_id.lower() != "all":
            q = q.filter(models.Station.id == station_id)
         
    results = q.group_by(models.Station.id, models.Station.name).all()
    
    stations_data = []
    for r in results:
        closed = r.closed or 0
        total = r.total or 0
        stations_data.append({
            "station_id": r.station_id,
            "station_name": r.station_name,
            "total_complaints": total,
            "closed_complaints": closed,
            "open_complaints": total - closed,
            "resolution_rate": round((closed / total * 100) if total > 0 else 0, 1)
        })
        
    return {"stations": stations_data}


@router.get("/officers/workload")
def officer_workload(
    days: int = Query(30),
    limit: int = Query(50),
    station_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    q = db.query(
        models.User.id.label("officer_id"),
        models.User.name.label("officer_name"),
        func.count(models.Case.id).label("total_cases"),
    ).join(models.Case, models.Case.assigned_officer_id == models.User.id) \
     .join(models.Complaint, models.Case.complaint_id == models.Complaint.id) \
     .filter(models.Complaint.created_at >= cutoff)
     
    if user.role == models.UserRole.COP and user.station_id:
        q = q.filter(models.User.station_id == user.station_id)
    elif user.role == models.UserRole.ADMIN:
        if station_id and station_id.lower() != "all":
            q = q.filter(models.User.station_id == station_id)

    results = q.group_by(models.User.id, models.User.name).limit(limit).all()
    
    officers = []
    for r in results:
        officers.append({
            "officer_id": str(r.officer_id),
            "officer_name": r.officer_name,
            "total_complaints": r.total_cases,
            "open_complaints": r.total_cases,
            "closed_complaints": 0 
        })
        
    return {"officers": officers}
