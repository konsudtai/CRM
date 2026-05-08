"""
Agent factory — creates Strands agents with tools + A2A.

Design:
  - Each agent gets its own tool set
  - A2A tools (ask_sales_assistant, ask_analytics_agent) are factory-bound
    to prevent circular imports and allow recursion control
"""
import os
from typing import Optional
from strands import Agent, tool
from strands.models import BedrockModel

from agents.prompts import ADMIN_PROMPT, SALES_PROMPT, ANALYTICS_PROMPT
from tools.crm_tools import ADMIN_TOOLS, SALES_TOOLS, ANALYTICS_TOOLS


MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0')
REGION = os.environ.get('BEDROCK_REGION', 'ap-southeast-1')


def _make_model(temperature: float = 0.4) -> BedrockModel:
    return BedrockModel(
        model_id=MODEL_ID,
        region_name=REGION,
        temperature=temperature,
    )


class AgentFactory:
    """Creates and caches the 3 agents. Supports A2A via closure refs."""

    def __init__(self) -> None:
        # Create A2A tools that capture this factory
        @tool
        def ask_sales_assistant(question: str) -> str:
            """ส่งคำถามให้ "น้องขายไว" (Sales Assistant) ตอบ — ใช้เมื่อต้องการข้อมูล CRM เชิงลึก.

            Args:
                question: คำถามที่ต้องการถาม (เช่น "ใครดูแลลูกค้า ABC", "สถานะ Lead ของ XYZ")
            """
            sales = self.get_sales()
            result = sales(question)
            return str(result.message) if hasattr(result, 'message') else str(result)

        @tool
        def ask_analytics_agent(question: str) -> str:
            """ส่งคำถามให้ "น้องวิ" (Analytics) วิเคราะห์ — ใช้เมื่อต้องการ forecast, win rate, เปรียบเทียบทีม.

            Args:
                question: คำถามวิเคราะห์
            """
            analytics = self.get_analytics()
            result = analytics(question)
            return str(result.message) if hasattr(result, 'message') else str(result)

        self._ask_sales = ask_sales_assistant
        self._ask_analytics = ask_analytics_agent
        self._admin: Optional[Agent] = None
        self._sales: Optional[Agent] = None
        self._analytics: Optional[Agent] = None

    def get_admin(self) -> Agent:
        """น้องแอ๊ด — greets customers, collects leads, delegates CRM questions."""
        if self._admin is None:
            self._admin = Agent(
                model=_make_model(temperature=0.3),
                system_prompt=ADMIN_PROMPT,
                tools=[*ADMIN_TOOLS, self._ask_sales, self._ask_analytics],
            )
        return self._admin

    def get_sales(self) -> Agent:
        """น้องขายไว — full CRM access, can delegate to analytics."""
        if self._sales is None:
            self._sales = Agent(
                model=_make_model(temperature=0.4),
                system_prompt=SALES_PROMPT,
                tools=[*SALES_TOOLS, self._ask_analytics],
            )
        return self._sales

    def get_analytics(self) -> Agent:
        """น้องวิ — analytics specialist, read-only CRM access."""
        if self._analytics is None:
            self._analytics = Agent(
                model=_make_model(temperature=0.2),
                system_prompt=ANALYTICS_PROMPT,
                tools=ANALYTICS_TOOLS,  # no A2A — terminal agent
            )
        return self._analytics

    def get(self, agent_type: str) -> Agent:
        """Route by type name."""
        if agent_type == 'admin':
            return self.get_admin()
        if agent_type == 'analytics':
            return self.get_analytics()
        return self.get_sales()  # default


# Singleton factory (one per process)
_factory: Optional[AgentFactory] = None


def get_factory() -> AgentFactory:
    global _factory
    if _factory is None:
        _factory = AgentFactory()
    return _factory


def detect_agent_type(message: str) -> str:
    """Auto-route message to correct agent based on keywords."""
    lower = message.lower()

    analytics_keywords = [
        'forecast', 'พยากรณ์', 'churn', 'เสี่ยงหาย', 'win rate', 'conversion',
        'เปรียบเทียบ', 'performance', 'ผลงาน', 'revenue', 'trend',
        'kpi', 'สรุปยอด', 'วิเคราะห์', 'avg deal',
    ]
    admin_keywords = [
        'สนใจสินค้า', 'ขอใบเสนอราคา', 'ติดต่อกลับ', 'สอบถามราคา',
        'บริการอะไร', 'ราคาเท่าไหร่', 'แพ็คเกจ',
    ]

    if any(k in lower for k in analytics_keywords):
        return 'analytics'
    if any(k in lower for k in admin_keywords):
        return 'admin'
    return 'sales-assistant'
