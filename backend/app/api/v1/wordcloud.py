"""
简历词云 API 路由
"""

from fastapi import APIRouter, Depends, Request

from app.config import Settings, get_settings
from app.db.repository import AbstractRepository
from app.models.schemas import (
    RefreshWordCloudRequest,
    RefreshWordCloudResponse,
    SkillDataResponse,
    SkillModuleResponse,
    WordCloudDataResponse,
)
from app.services.security import get_optional_user
from app.services.wordcloud_fetcher import fetch_skill_data, fetch_all_skill_data

router = APIRouter(prefix="/wordcloud", tags=["wordcloud"])


@router.get("", response_model=WordCloudDataResponse)
async def get_wordcloud_data(
    request: Request,
    module_type: str = "frontend",
    current_user=Depends(get_optional_user),
) -> WordCloudDataResponse:
    """
    获取简历词云数据
    
    Args:
        module_type: 模块类型（frontend/backend/ai/mobile/devops/data）
        
    Returns:
        WordCloudDataResponse: 包含模块列表和技能数据
    """
    repository: AbstractRepository = request.app.state.repository
    settings: Settings = get_settings()
    
    modules = await repository.get_skill_modules()
    if not modules:
        all_data = await fetch_all_skill_data()
        for module_type_key, (module, skills) in all_data.items():
            await repository.upsert_skill_module(module)
            await repository.save_skills(skills)
        modules = await repository.get_skill_modules()
    
    skills = await repository.get_skills_by_module(module_type)
    if not skills:
        module, skills = await fetch_skill_data(module_type)
        await repository.upsert_skill_module(module)
        await repository.save_skills(skills)
    
    module_responses = [
        SkillModuleResponse(
            id=m.id,
            module_type=m.module_type,
            name=m.name,
            icon=m.icon,
            skill_count=m.skill_count,
            trend=m.trend,
            updated_at=m.updated_at,
        )
        for m in modules
    ]
    
    skill_responses = [
        SkillDataResponse(
            id=s.id,
            skill_name=s.skill_name,
            category=s.category,
            demand_count=s.demand_count,
            trend=s.trend,
            rank=s.rank,
        )
        for s in skills
    ]
    
    current_module = await repository.get_skill_module_by_type(module_type)
    updated_at = current_module.updated_at if current_module else modules[0].updated_at if modules else None
    
    return WordCloudDataResponse(
        modules=module_responses,
        skills=skill_responses,
        module_type=module_type,
        updated_at=updated_at,
    )


@router.post("/refresh", response_model=RefreshWordCloudResponse)
async def refresh_wordcloud_data(
    request: Request,
    payload: RefreshWordCloudRequest,
    current_user=Depends(get_optional_user),
) -> RefreshWordCloudResponse:
    """
    刷新指定模块的词云数据
    
    从BOSS直聘等招聘网站获取最新数据并保存到数据库
    
    Args:
        payload: 包含要刷新的模块类型
        
    Returns:
        RefreshWordCloudResponse: 刷新结果
    """
    repository: AbstractRepository = request.app.state.repository
    settings: Settings = get_settings()
    
    valid_types = ["frontend", "backend", "ai", "mobile", "devops", "data"]
    if payload.module_type not in valid_types:
        return RefreshWordCloudResponse(
            success=False,
            module_type=payload.module_type,
            skill_count=0,
            message=f"无效的模块类型: {payload.module_type}，有效类型: {', '.join(valid_types)}",
        )
    
    try:
        module, skills = await fetch_skill_data(payload.module_type)
        
        await repository.upsert_skill_module(module)
        await repository.save_skills(skills)
        
        return RefreshWordCloudResponse(
            success=True,
            module_type=payload.module_type,
            skill_count=len(skills),
            message=f"成功刷新 {module.name} 模块数据，共 {len(skills)} 个技能",
        )
    except Exception as e:
        return RefreshWordCloudResponse(
            success=False,
            module_type=payload.module_type,
            skill_count=0,
            message=f"刷新失败: {str(e)}",
        )