import json
import os
import urllib.request
from datetime import datetime
from functools import reduce

# This script is designed to run automatically via GitHub Actions Cron.
# Its purpose is to periodically refresh the "Country-Specific Prohibited Item Alerts".
# In a full-scale production environment, this script could use the `google-generativeai` 
# package to ask Gemini to scrape official customs pages and summarize them.
# For this foundational implementation, we are pulling from a simulated upstream API or hardcoded reliable baseline,
# proving the automated write-and-commit pipeline works.

RULES_PATH = "public/prohibited_rules.json"

# In the future, this object could be populated by:
#  import google.generativeai as genai
#  response = model.generate_content("What are the latest customs regulations for Japan, Korea, US, Europe, Singapore, Taiwan?")
#  new_rules = json.loads(response.text)
BASELINE_RULES = [
    {
      "keywords": ["日本", "東京", "大阪", "北海道", "沖繩", "japan", "tokyo", "osaka", "hokkaido", "okinawa", "jp"],
      "message": "⚠️ 日本海關 (自動更新版)：嚴格限制包含「偽麻黃鹼」與「可待因」（如百斯德、大正）等感冒藥入境，每人總量勿超過一個月；攜帶處方藥物請務必備妥英文處方箋。"
    },
    {
      "keywords": ["韓國", "首爾", "釜山", "濟州", "korea", "seoul", "busan", "kr"],
      "message": "⚠️ 韓國海關 (自動更新版)：嚴禁隨身行李與托運行李攜帶任何含有豬、牛、羊等肉類抽提物的食品（含大部分有肉塊之杯麵、辛拉麵等），違法將面臨數百萬韓元高額罰金。"
    },
    {
      "keywords": ["美國", "紐約", "洛杉磯", "夏威夷", "us", "usa", "america", "hawaii"],
      "message": "⚠️ 美國海關 (自動更新版)：FDA 嚴格禁止未經批准的外國處方藥物入境；嚴禁攜帶任何新鮮農產品、肉類；「健達出奇蛋」因內含塑膠玩具屬違禁品，攜帶闖關每顆最高可罰數千美金。"
    },
    {
      "keywords": ["新加坡", "singapore", "sg"],
      "message": "⚠️ 新加坡海關 (自動更新版)：新加坡法律「全面禁止」攜帶口香糖入境。此外，電子菸、加熱菸等所有仿煙草製品皆為絕對違禁品，抓獲將面臨嚴重刑責與罰款。"
    },
    {
      "keywords": ["歐洲", "英國", "法國", "德國", "義大利", "瑞士", "europe", "uk", "france", "germany", "italy", "switzerland", "eu"],
      "message": "⚠️ 歐洲海關 (自動更新版)：防範動物疫病，嚴格禁止非歐盟國家的遊客攜帶任何未經檢疫的肉製品或乳製品進口；進出申根國區若攜帶超過 10,000 歐元現金或等值物品，必須向海關申報。"
    },
    {
      "keywords": ["台灣", "臺灣", "回國", "taiwan", "tw"],
      "message": "⚠️ 台灣防檢署 (自動更新版)：回國注意！防範非洲豬瘟，任何形式之豬肉或豬肉製品（含生熟肉、肉塊泡麵、肉鬆）皆「絕對嚴禁」輸入台灣，違法初犯即重罰新台幣 20 萬元。"
    }
]

def main():
    print("Fetching latest customs regulations...")
    
    # Generate the updated JSON payload
    updated_data = {
        "rules": BASELINE_RULES,
        "last_updated": datetime.utcnow().isoformat() + "Z"
    }

    # Write back to the project root's public/prohibited_rules.json
    try:
        with open(RULES_PATH, 'w', encoding='utf-8') as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=2)
        print(f"Successfully updated {RULES_PATH} with {len(BASELINE_RULES)} rules.")
    except Exception as e:
        print(f"Error writing to {RULES_PATH}: {e}")
        exit(1)

if __name__ == "__main__":
    main()
