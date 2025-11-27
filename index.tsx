
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import { Loader2, Check, ChefHat, ShoppingCart, Calendar, ArrowRight, RefreshCcw, Info, Flame, Leaf, Utensils, AlertCircle } from "lucide-react";

// --- Utilities ---

const cleanJson = (text: string) => {
  if (!text) return "[]";
  let cleaned = text.trim();
  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
};

// Static map of images to give a "Real Menu" feel without expensive generation
const getFoodImage = (name: string, tags: string[]) => {
  const n = name.toLowerCase();
  const t = tags.join(" ").toLowerCase();
  
  const images: Record<string, string> = {
    fish: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
    shrimp: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
    beef: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
    pork: "https://images.unsplash.com/photo-1608620888949-055f17a94b46?auto=format&fit=crop&w=800&q=80",
    chicken: "https://images.unsplash.com/photo-1610057099443-fde8c4d29f92?auto=format&fit=crop&w=800&q=80",
    duck: "https://images.unsplash.com/photo-1532258848416-29e2f470550f?auto=format&fit=crop&w=800&q=80",
    vegetable: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
    tofu: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
    egg: "https://images.unsplash.com/photo-1524855470716-41712a32c25a?auto=format&fit=crop&w=800&q=80",
    soup: "https://images.unsplash.com/photo-1547592166-23acbe3a624b?auto=format&fit=crop&w=800&q=80",
    salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
    noodle: "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=800&q=80",
    rice: "https://images.unsplash.com/photo-1516685018646-549198525c1b?auto=format&fit=crop&w=800&q=80",
    spicy: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80",
    tomato: "https://images.unsplash.com/photo-1592187270271-9a4b84faa228?auto=format&fit=crop&w=800&q=80",
    potato: "https://images.unsplash.com/photo-1518977676601-b53f82a6b6dc?auto=format&fit=crop&w=800&q=80",
    braised: "https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=800&q=80",
  };

  if (n.includes("鱼") || n.includes("fish")) return images.fish;
  if (n.includes("虾") || n.includes("shrimp")) return images.shrimp;
  if (n.includes("牛") || n.includes("beef")) return images.beef;
  if (n.includes("排骨") || n.includes("肉") || n.includes("pork") || n.includes("红烧")) return images.pork;
  if (n.includes("鸡") || n.includes("chicken")) return images.chicken;
  if (n.includes("鸭") || n.includes("duck")) return images.duck;
  if (n.includes("豆腐") || n.includes("tofu")) return images.tofu;
  if (n.includes("蛋") || n.includes("egg")) return images.egg;
  if (n.includes("汤") || n.includes("soup")) return images.soup;
  if (n.includes("面") || n.includes("noodle")) return images.noodle;
  if (n.includes("西红柿") || n.includes("番茄") || n.includes("tomato")) return images.tomato;
  if (n.includes("土豆") || n.includes("potato")) return images.potato;
  if (t.includes("salad") || t.includes("凉拌")) return images.salad;
  if (t.includes("spicy") || t.includes("辣")) return images.spicy;
  if (t.includes("braised") || t.includes("炖")) return images.braised;

  // Default fallback
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
};

// --- Components ---

const App = () => {
  const [step, setStep] = useState<"welcome" | "selection" | "planning" | "dashboard">("welcome");
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || "");
  const [recommendations, setRecommendations] = useState<Dish[]>([]);
  const [selectedDishIds, setSelectedDishIds] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<DailyPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingCategory[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize GenAI
  const ai = new GoogleGenAI({ apiKey });

  const fetchRecommendations = async () => {
    if (!apiKey) {
      setError("未检测到 API Key。请在部署环境配置 API_KEY 环境变量。");
      return;
    }

    setLoading(true);
    setLoadingMessage("正在为您挑选适合减脂的家常菜...");
    setError(null);
    try {
      const model = "gemini-2.5-flash";
      const prompt = `
        Recommend 12 distinct, healthy, and weight-loss friendly dinner dishes suitable for Chinese home cooking.
        
        Requirements:
        - Variety: Include a mix of stir-fry, steamed, boiled, and cold dishes.
        - Flavors: Include diverse styles like Sichuan (mildly spicy), Cantonese (light), Home-style (savory).
        - Ingredients: Easy to find in standard supermarkets. High protein, moderate carbs, plenty of vegetables.
        - Level: Beginner friendly.
        
        Return a JSON array. Each object should have:
        - id: string (unique)
        - name: string (Chinese name of the dish, e.g. "西红柿炒鸡蛋")
        - description: string (very brief description of taste, e.g. "酸甜开胃，营养丰富")
        - tags: string array (e.g., "高蛋白", "快手菜", "低脂", "川味", "清淡")
        - calories: string (approximate calories per serving, e.g. "300大卡")
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                calories: { type: Type.STRING },
              },
              required: ["id", "name", "description", "tags", "calories"],
            },
          },
        },
      });

      const jsonText = cleanJson(response.text || "");
      const data = JSON.parse(jsonText);
      
      // Enrich with images
      const enrichedData = data.map((d: any) => ({
        ...d,
        image: getFoodImage(d.name, d.tags)
      }));

      setRecommendations(enrichedData);
      setStep("selection");
    } catch (err) {
      console.error(err);
      setError("获取推荐失败，请检查网络或 API 配置。");
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    if (selectedDishIds.size === 0) return;
    
    setLoading(true);
    setLoadingMessage("正在根据您的选择规划下周食谱...");
    setError(null);
    setStep("planning");
    
    try {
      const selectedDishes = recommendations.filter(r => selectedDishIds.has(r.id));
      const selectedNames = selectedDishes.map(d => d.name).join(", ");

      const model = "gemini-2.5-flash";
      
      // 1. Generate Weekly Schedule
      const planPrompt = `
        User selected these dishes: ${selectedNames}.
        Create a 5-day dinner plan (Monday to Friday) suitable for weight loss.
        Distribute the selected dishes across the week. 
        If there are fewer than 5 selected, repeat the best ones or suggest a very similar simple variation to fill the gap.
        
        Return a JSON array of 5 objects (one for each day).
        Each object:
        - day: string (e.g., "周一")
        - mainDish: string (name from selection or variation)
        - sideDish: string (a simple side dish to pair with, e.g., "清炒西兰花", "拍黄瓜")
        - reason: string (why this combo is good)
      `;

      const planResponse = await ai.models.generateContent({
        model,
        contents: planPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                mainDish: { type: Type.STRING },
                sideDish: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["day", "mainDish", "sideDish", "reason"],
            },
          },
        },
      });

      const planJson = cleanJson(planResponse.text || "");
      const planData = JSON.parse(planJson);
      setPlan(planData);

      // 2. Generate Shopping List & Recipes
      setLoadingMessage("正在生成购物清单和制作步骤...");
      
      const allDishes = planData.map((d: any) => `${d.mainDish} (Main) + ${d.sideDish} (Side)`).join("; ");
      const detailsPrompt = `
        Based on this weekly plan: ${allDishes}.
        
        Task 1: Generate a consolidated shopping list.
        Task 2: Provide simple, beginner-friendly recipes for EVERY unique MAIN dish and SIDE dish mentioned in the plan.
        Keep steps concise and clear.
        
        Return JSON object:
        {
          "shoppingList": [
            { "category": "category name (e.g. 蔬菜, 肉类, 调味品)", "items": ["item 1", "item 2"] }
          ],
          "recipes": [
            {
              "dishName": "name",
              "type": "Main" or "Side",
              "ingredients": ["ing 1", "ing 2"],
              "steps": ["step 1", "step 2"],
              "tips": "useful tip for beginners"
            }
          ]
        }
      `;

      const detailsResponse = await ai.models.generateContent({
        model,
        contents: detailsPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shoppingList: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    items: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              },
              recipes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dishName: { type: Type.STRING },
                    type: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tips: { type: Type.STRING }
                  }
                }
              }
            }
          },
        },
      });
      
      const detailsJson = cleanJson(detailsResponse.text || "");
      const detailsData = JSON.parse(detailsJson);
      
      setShoppingList(detailsData.shoppingList || []);
      setRecipes(detailsData.recipes || []);
      
      setStep("dashboard");

    } catch (err) {
      console.error(err);
      setError("生成计划失败，请重试。");
      setStep("selection"); // Go back
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedDishIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedDishIds(newSet);
  };

  // --- Render Functions ---

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-emerald-800 mb-2">{loadingMessage}</h2>
        <p className="text-emerald-600">AI 正在为您精心规划...</p>
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-2xl text-center relative z-10">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <ChefHat className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-emerald-900 mb-3">周度减脂晚餐规划</h1>
          <p className="text-emerald-800/80 mb-6 leading-relaxed font-medium">
            不知道下周吃什么？<br/>
            专为厨艺小白设计，简单食材，健康低脂。<br/>
            选择您心仪的菜品，剩下的交给我们。
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-3 border border-red-100 text-left animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <span className="font-bold block mb-1">出错了</span>
                {error}
              </div>
            </div>
          )}

          <button 
            onClick={fetchRecommendations}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200/50 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
          >
            开始选菜 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "selection") {
    return (
      <div className="min-h-screen bg-stone-50 p-4 md:p-8">
        <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
              <Utensils className="w-6 h-6 text-emerald-600" />
              第一步：选择你想吃的
            </h1>
            <p className="text-stone-500 mt-1">至少选择 3 道菜，我们会为您安排周一到周五的健康搭配。</p>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={fetchRecommendations}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg flex items-center gap-2 transition-colors border border-stone-200"
            >
              <RefreshCcw className="w-4 h-4" /> 换一批
            </button>
            <button 
              onClick={generatePlan}
              disabled={selectedDishIds.size < 1}
              className={`px-8 py-2 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 ${
                selectedDishIds.size > 0 
                ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg transform hover:-translate-y-0.5" 
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              生成计划 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {error && (
          <div className="max-w-7xl mx-auto mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
            <Info className="w-5 h-5" /> {error}
          </div>
        )}

        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {recommendations.map((dish) => {
            const isSelected = selectedDishIds.has(dish.id);
            return (
              <div 
                key={dish.id}
                onClick={() => toggleSelection(dish.id)}
                className={`group cursor-pointer relative bg-white rounded-2xl shadow-sm transition-all duration-300 overflow-hidden flex flex-col h-full ${
                  isSelected 
                  ? "ring-2 ring-emerald-500 shadow-xl transform scale-[1.02]" 
                  : "hover:shadow-lg hover:-translate-y-1"
                }`}
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={dish.image} 
                    alt={dish.name}
                    className={`w-full h-full object-cover transition-transform duration-700 ${isSelected ? "scale-110" : "group-hover:scale-105"}`}
                  />
                  <div className={`absolute inset-0 bg-black/20 transition-opacity ${isSelected ? "opacity-0" : "opacity-0 group-hover:opacity-10"}`}></div>
                  
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" /> {dish.calories}
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-2">
                    <h3 className="font-bold text-xl text-gray-900 leading-tight mb-1">{dish.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {dish.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full font-medium border border-stone-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed flex-1">
                    {dish.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Floating Action Button for Mobile */}
        <div className="fixed bottom-6 right-6 md:hidden z-20">
          <button 
            onClick={generatePlan}
            disabled={selectedDishIds.size < 1}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
               selectedDishIds.size > 0 ? "bg-emerald-600 text-white" : "bg-stone-300 text-stone-500"
            }`}
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "dashboard") {
    return <Dashboard plan={plan} shoppingList={shoppingList} recipes={recipes} onRestart={() => setStep("selection")} />;
  }

  return null;
};

// --- Sub-components for Dashboard ---

const Dashboard = ({ plan, shoppingList, recipes, onRestart }: { 
  plan: DailyPlan[], 
  shoppingList: ShoppingCategory[], 
  recipes: Recipe[],
  onRestart: () => void 
}) => {
  const [activeTab, setActiveTab] = useState<"menu" | "shopping" | "recipes">("menu");

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Navbar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="font-bold text-xl text-emerald-800 flex items-center gap-2">
              <ChefHat className="w-6 h-6" /> 
              <span className="hidden sm:inline">下周晚餐计划</span>
              <span className="sm:hidden">晚餐计划</span>
            </div>
            <button onClick={onRestart} className="text-sm font-medium text-stone-500 hover:text-emerald-600 px-3 py-1 rounded-md hover:bg-emerald-50 transition-colors">
              重新开始
            </button>
          </div>
          <div className="flex gap-8 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab("menu")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === "menu" ? "border-emerald-500 text-emerald-600" : "border-transparent text-stone-400"}`}
            >
              <Calendar className="w-4 h-4" /> 本周食谱
            </button>
            <button 
              onClick={() => setActiveTab("shopping")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === "shopping" ? "border-emerald-500 text-emerald-600" : "border-transparent text-stone-400"}`}
            >
              <ShoppingCart className="w-4 h-4" /> 购物清单
            </button>
            <button 
              onClick={() => setActiveTab("recipes")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === "recipes" ? "border-emerald-500 text-emerald-600" : "border-transparent text-stone-400"}`}
            >
              <Utensils className="w-4 h-4" /> 制作教程
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          
          {activeTab === "menu" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-xl font-bold text-stone-800">周一至周五 晚餐安排</h2>
              </div>
              
              {plan.map((day, idx) => (
                <div key={idx} className="bg-white rounded-xl p-0 shadow-sm border border-stone-100 flex flex-col sm:flex-row overflow-hidden hover:shadow-md transition-shadow">
                  <div className="sm:w-24 bg-emerald-50 flex flex-row sm:flex-col items-center justify-between sm:justify-center p-4 sm:p-0 text-emerald-800 font-bold border-b sm:border-b-0 sm:border-r border-emerald-100">
                    <span className="text-sm opacity-70">DAY</span>
                    <span className="text-xl">{day.day.replace("周", "")}</span>
                  </div>
                  <div className="flex-1 p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">主菜</span>
                          <h3 className="font-bold text-lg text-gray-900">{day.mainDish}</h3>
                        </div>
                        <div className="hidden md:block text-stone-300">|</div>
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">配菜</span>
                           <h3 className="font-medium text-gray-700">{day.sideDish}</h3>
                        </div>
                      </div>
                      <p className="text-sm text-stone-500 bg-stone-50 p-3 rounded-lg flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 text-stone-400 flex-shrink-0" />
                        {day.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "shopping" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="bg-amber-50 p-6 border-b border-amber-100">
                   <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                     <ShoppingCart className="w-6 h-6" /> 准备清单
                   </h2>
                   <p className="text-amber-700 text-sm mt-1">
                     这是为您这周 5 顿晚餐准备的所有食材，去超市一次买齐吧！
                   </p>
                </div>
                <div className="p-6 grid md:grid-cols-2 gap-8">
                  {shoppingList.map((cat, idx) => (
                    <div key={idx} className="bg-stone-50 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b border-stone-200 pb-2 flex justify-between items-center">
                        {cat.category}
                        <span className="text-xs font-normal bg-stone-200 px-2 py-0.5 rounded-full">{cat.items.length}</span>
                      </h3>
                      <div className="space-y-2">
                        {cat.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm border border-stone-100 hover:border-emerald-200 transition-colors cursor-default group">
                            <div className="w-5 h-5 rounded-md border-2 border-stone-300 group-hover:border-emerald-400 transition-colors"></div>
                            <span className="text-stone-700 font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "recipes" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
               {recipes.length === 0 ? (
                 <div className="text-center py-10 text-stone-500 bg-white rounded-2xl p-8">
                   <p>暂无食谱，请尝试重新生成。</p>
                 </div>
               ) : recipes.map((recipe, idx) => (
                 <div key={idx} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                   <div className="bg-gradient-to-r from-stone-50 to-white px-6 py-4 border-b border-stone-100 flex flex-wrap justify-between items-center gap-2">
                     <h3 className="font-bold text-xl text-stone-800 flex items-center gap-2">
                       {recipe.dishName}
                     </h3>
                     <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${recipe.type === 'Main' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {recipe.type === 'Main' ? '主菜' : '配菜'}
                     </span>
                   </div>
                   <div className="p-6 grid md:grid-cols-3 gap-8">
                     {/* Ingredients Column */}
                     <div className="md:col-span-1">
                       <h4 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
                         <Leaf className="w-4 h-4" /> 所需食材
                       </h4>
                       <ul className="space-y-2">
                         {recipe.ingredients.map((ing, i) => (
                           <li key={i} className="flex items-center gap-2 text-sm text-stone-700 bg-emerald-50/50 p-2 rounded border border-emerald-100/50">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                             {ing}
                           </li>
                         ))}
                       </ul>
                     </div>
                     
                     {/* Steps Column */}
                     <div className="md:col-span-2">
                        <h4 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
                          <Flame className="w-4 h-4" /> 制作步骤
                        </h4>
                        <div className="space-y-4">
                          {recipe.steps.map((step, i) => (
                            <div key={i} className="flex gap-4">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 text-stone-500 border border-stone-200 flex items-center justify-center text-xs font-bold mt-0.5">
                                {i + 1}
                              </span>
                              <p className="text-stone-700 leading-relaxed text-sm md:text-base">{step}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex gap-3 items-start border border-blue-100">
                          <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                          <div>
                            <span className="font-bold block mb-1 text-blue-900">小白贴士</span>
                            {recipe.tips}
                          </div>
                        </div>
                     </div>
                   </div>
                 </div>
               ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};


// --- Types ---

interface Dish {
  id: string;
  name: string;
  description: string;
  tags: string[];
  image: string;
  calories: string;
}

interface DailyPlan {
  day: string;
  mainDish: string;
  sideDish: string;
  reason: string;
}

interface ShoppingCategory {
  category: string;
  items: string[];
}

interface Recipe {
  dishName: string;
  type: string;
  ingredients: string[];
  steps: string[];
  tips: string;
}

const root = createRoot(document.getElementById("app")!);
root.render(<App />);

export default App;
