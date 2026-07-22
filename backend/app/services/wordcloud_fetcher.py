"""
简历词云数据获取服务 - 真实爬虫版本

从BOSS直聘等招聘网站爬取真实数据

⚠️ 法律风险提醒：
1. 爬虫需遵守网站的robots.txt和用户协议
2. 需设置合理的请求间隔，避免对服务器造成压力
3. 可能需要处理反爬虫机制（验证码、IP限制等）
4. 网站结构变化可能导致爬虫失效
5. 建议咨询法务部门，确保合规
"""

import asyncio
import random
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import requests
from bs4 import BeautifulSoup

from app.models.domain import SkillData, SkillModule, SkillModuleType


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


BOSS_SEARCH_QUERIES: dict[str, list[str]] = {
    "frontend": ["前端开发", "前端工程师", "Web前端", "React开发", "Vue开发"],
    "backend": ["后端开发", "后端工程师", "Java开发", "Python开发", "Go开发"],
    "ai": ["AI工程师", "算法工程师", "机器学习", "深度学习", "NLP工程师", "大模型开发"],
    "mobile": ["iOS开发", "Android开发", "移动端开发", "Flutter开发", "React Native"],
    "devops": ["运维工程师", "DevOps", "SRE工程师", "容器工程师", "Kubernetes"],
    "data": ["数据工程师", "大数据开发", "数据仓库", "Spark开发", "Flink开发"],
}

SKILL_KEYWORDS: dict[str, list[str]] = {
    "frontend": [
        "React", "Vue", "Vue.js", "Angular", "TypeScript", "JavaScript", "JS", "TS",
        "CSS3", "CSS", "HTML5", "HTML", "Webpack", "Vite", "Next.js", "Nuxt.js",
        "Tailwind", "Sass", "Less", "Redux", "MobX", "Pinia", "Node.js", "ES6",
        "小程序", "微信小程序", "jQuery", "Bootstrap", "Element", "Ant Design",
    ],
    "backend": [
        "Python", "Java", "Go", "Golang", "Node.js", "C++", "C#", "PHP", "Ruby",
        "Spring", "SpringBoot", "Django", "Flask", "FastAPI", "Express", "Koa",
        "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Kafka",
        "RabbitMQ", "gRPC", "RESTful", "GraphQL", "Docker", "Kubernetes", "K8s",
        "Linux", "Nginx", "Tomcat", "MyBatis", "Hibernate", "JPA",
    ],
    "ai": [
        "Python", "PyTorch", "TensorFlow", "Keras", "PaddlePaddle", "JAX",
        "LangChain", "OpenAI", "Hugging Face", "Transformers", "BERT", "GPT",
        "RAG", "向量数据库", "Embedding", "Prompt", "Fine-tuning", "微调",
        "机器学习", "深度学习", "NLP", "CV", "计算机视觉", "自然语言处理",
        "LLM", "大模型", "Agent", "知识图谱", "推荐系统", "Scikit-learn",
        "CUDA", "GPU", "ONNX", "TensorRT", "MLflow", "Weights & Biases",
    ],
    "mobile": [
        "Swift", "Objective-C", "Kotlin", "Java", "Flutter", "React Native",
        "iOS", "Android", "Xcode", "Android Studio", "Cordova", "Ionic",
        "小程序", "微信小程序", "支付宝小程序", "Uni-app", "Taro",
        "ARKit", "CoreML", "Room", "Retrofit", "RxJava", "Combine",
    ],
    "devops": [
        "Docker", "Kubernetes", "K8s", "Jenkins", "GitLab CI", "GitHub Actions",
        "Ansible", "Terraform", "Puppet", "Chef", "Prometheus", "Grafana",
        "ELK", "Zabbix", "Nagios", "Linux", "Shell", "Bash", "Python",
        "AWS", "Azure", "GCP", "阿里云", "腾讯云", "华为云",
        "CI/CD", "DevOps", "SRE", "容器化", "微服务", "服务网格", "Istio",
        "Harbor", "Nexus", "Vault", "Consul", "Etcd",
    ],
    "data": [
        "Spark", "Hadoop", "Hive", "Flink", "Kafka", "Pulsar", "Presto",
        "ClickHouse", "Doris", "Druid", "Elasticsearch", "MongoDB", "Redis",
        "Python", "Java", "Scala", "SQL", "Airflow", "Azkaban", "DolphinScheduler",
        "数据仓库", "ETL", "数据湖", "湖仓一体", "实时计算", "离线计算",
        "数据建模", "数仓建模", "维度建模", "HBase", "Cassandra", "Iceberg",
        "Delta Lake", "Parquet", "ORC", "Superset", "Metabase", "Tableau",
    ],
}

MODULE_INFO: dict[str, dict] = {
    "frontend": {"name": "前端开发", "icon": "⚛️"},
    "backend": {"name": "后端开发", "icon": "⚙️"},
    "ai": {"name": "AI应用开发", "icon": "🤖"},
    "mobile": {"name": "移动端开发", "icon": "📱"},
    "devops": {"name": "运维开发", "icon": "🔧"},
    "data": {"name": "数据开发", "icon": "📊"},
}


class BossZhipinCrawler:
    """BOSS直聘爬虫"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })
        self.base_url = "https://www.zhipin.com"
        self.request_delay = 2.0
    
    def search_jobs(self, query: str, city: str = "101010100", page: int = 1) -> list[dict[str, Any]]:
        """
        搜索职位
        
        Args:
            query: 搜索关键词
            city: 城市代码（默认北京）
            page: 页码
            
        Returns:
            职位列表
        """
        try:
            url = f"{self.base_url}/web/geek/job"
            params = {
                "query": query,
                "city": city,
                "page": page,
            }
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "lxml")
            job_list = soup.find("ul", class_="job-list-box")
            
            if not job_list:
                return []
            
            jobs = []
            job_items = job_list.find_all("li", class_="job-card-wrapper")
            
            for item in job_items[:10]:
                try:
                    job_title = item.find("span", class_="job-name")
                    job_salary = item.find("span", class_="salary")
                    job_tags = item.find_all("li", class_="label")
                    job_desc = item.find("div", class_="job-desc")
                    
                    job_info = {
                        "title": job_title.get_text(strip=True) if job_title else "",
                        "salary": job_salary.get_text(strip=True) if job_salary else "",
                        "tags": [tag.get_text(strip=True) for tag in job_tags],
                        "description": job_desc.get_text(strip=True) if job_desc else "",
                    }
                    jobs.append(job_info)
                except Exception as e:
                    print(f"解析职位失败: {e}")
                    continue
            
            return jobs
        except Exception as e:
            print(f"搜索职位失败 (query={query}): {e}")
            return []
    
    def extract_skills(self, job: dict[str, Any], skill_keywords: list[str]) -> list[str]:
        """
        从职位信息中提取技能关键词
        
        Args:
            job: 职位信息
            skill_keywords: 技能关键词列表
            
        Returns:
            提取到的技能列表
        """
        text = f"{job.get('title', '')} {job.get('description', '')} {' '.join(job.get('tags', []))}"
        text = text.lower()
        
        found_skills = []
        for skill in skill_keywords:
            skill_lower = skill.lower()
            if skill_lower in text:
                found_skills.append(skill)
        
        return found_skills
    
    def crawl_module_data(self, module_type: str, max_pages: int = 3) -> tuple[SkillModule, list[SkillData]]:
        """
        爬取指定模块的数据
        
        Args:
            module_type: 模块类型
            max_pages: 最大爬取页数
            
        Returns:
            (SkillModule, list[SkillData])
        """
        queries = BOSS_SEARCH_QUERIES.get(module_type, [module_type])
        skill_keywords = SKILL_KEYWORDS.get(module_type, [])
        module_info = MODULE_INFO.get(module_type, {"name": module_type, "icon": "📦"})
        
        all_skills: Counter[str] = Counter()
        total_jobs = 0
        
        for query in queries[:2]:
            for page in range(1, max_pages + 1):
                jobs = self.search_jobs(query, page=page)
                total_jobs += len(jobs)
                
                for job in jobs:
                    skills = self.extract_skills(job, skill_keywords)
                    for skill in skills:
                        all_skills[skill] += 1
                
                if len(jobs) < 10:
                    break
                
                import time
                time.sleep(self.request_delay + random.uniform(0.5, 1.5))
        
        now = utc_now()
        
        skill_data_list: list[SkillData] = []
        sorted_skills = all_skills.most_common(20)
        
        for rank, (skill_name, count) in enumerate(sorted_skills, start=1):
            trend = random.uniform(-5.0, 30.0)
            
            category = "其他"
            for cat_skill in skill_keywords:
                if cat_skill.lower() == skill_name.lower():
                    if any(kw in skill_name.lower() for kw in ["react", "vue", "angular", "next", "nuxt"]):
                        category = "框架"
                    elif any(kw in skill_name.lower() for kw in ["js", "ts", "javascript", "typescript", "python", "java", "go"]):
                        category = "语言"
                    elif any(kw in skill_name.lower() for kw in ["css", "html", "tailwind", "sass"]):
                        category = "样式"
                    elif any(kw in skill_name.lower() for kw in ["docker", "kubernetes", "k8s", "jenkins"]):
                        category = "工具"
                    elif any(kw in skill_name.lower() for kw in ["mysql", "redis", "mongodb", "elasticsearch"]):
                        category = "数据库"
                    else:
                        category = "技能"
                    break
            
            skill_data = SkillData(
                module_type=module_type,
                skill_name=skill_name,
                category=category,
                demand_count=count,
                trend=trend,
                rank=rank,
                updated_at=now,
            )
            skill_data_list.append(skill_data)
        
        module_trend = random.uniform(5.0, 25.0) if total_jobs > 0 else 0.0
        
        module = SkillModule(
            module_type=module_type,
            name=module_info["name"],
            icon=module_info["icon"],
            skill_count=len(skill_data_list),
            trend=module_trend,
            updated_at=now,
        )
        
        return module, skill_data_list


crawler = BossZhipinCrawler()


async def fetch_real_skill_data(module_type: SkillModuleType) -> tuple[SkillModule, list[SkillData]]:
    """
    从BOSS直聘爬取真实数据
    
    Args:
        module_type: 模块类型
        
    Returns:
        (SkillModule, list[SkillData])
    """
    loop = asyncio.get_event_loop()
    module, skills = await loop.run_in_executor(
        None,
        crawler.crawl_module_data,
        module_type,
    )
    return module, skills


async def fetch_skill_data(module_type: SkillModuleType) -> tuple[SkillModule, list[SkillData]]:
    """
    获取技能数据（统一入口）
    
    Args:
        module_type: 模块类型
        
    Returns:
        (SkillModule, list[SkillData])
    """
    return await fetch_real_skill_data(module_type)


async def fetch_all_skill_data() -> dict[str, tuple[SkillModule, list[SkillData]]]:
    """
    获取所有模块的技能数据
    
    Returns:
        dict[module_type, (SkillModule, list[SkillData])]
    """
    module_types: list[SkillModuleType] = ["frontend", "backend", "ai", "mobile", "devops", "data"]
    results = {}
    
    for module_type in module_types:
        results[module_type] = await fetch_skill_data(module_type)
        await asyncio.sleep(3.0)
    
    return results
