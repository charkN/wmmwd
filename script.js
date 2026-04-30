const recipeForm = document.querySelector("#recipe-form");
const recipeNameInput = document.querySelector("#recipe-name");
const recipeIngredientsInput = document.querySelector("#recipe-ingredients");
const recipeList = document.querySelector("#recipe-list");
const recipeCount = document.querySelector("#recipe-count");
const socialImportForm = document.querySelector("#social-import-form");
const socialImportUrlInput = document.querySelector("#social-import-url");
const socialImportCaptionInput = document.querySelector("#social-import-caption");
const fetchPreviewButton = document.querySelector("#fetch-preview-button");
const importProviderBadge = document.querySelector("#import-provider-badge");
const importPreview = document.querySelector("#import-preview");
const importStatus = document.querySelector("#import-status");
const importDraft = document.querySelector("#import-draft");
const weekMenu = document.querySelector("#week-menu");
const groceryRecipeFilters = document.querySelector("#grocery-recipe-filters");
const groceryFilterToggle = document.querySelector("#grocery-filter-toggle");
const groceryItemForm = document.querySelector("#grocery-item-form");
const groceryItemNameInput = document.querySelector("#grocery-item-name");
const groceryList = document.querySelector("#grocery-list");
const groceryCount = document.querySelector("#grocery-count");
const makeMenuButton = document.querySelector("#make-menu-button");
const chooseMenuButton = document.querySelector("#choose-menu-button");
const menuChooserModal = document.querySelector("#menu-chooser-modal");
const menuChooserForm = document.querySelector("#menu-chooser-form");
const menuChooserList = document.querySelector("#menu-chooser-list");
const menuChooserStatus = document.querySelector("#menu-chooser-status");
const closeMenuChooserButton = document.querySelector("#close-menu-chooser-button");
const storageStatus = document.querySelector("#storage-status");
const blockTabs = document.querySelectorAll("[data-block-target]");
const appBlocks = document.querySelectorAll(".app-block");

const storageKey = "week-menu-maker-recipes";
const menuStorageKey = "week-menu-maker-current-menu";
const includedRecipesStorageKey = "week-menu-maker-included-grocery-recipes";
const groceryStorageKey = "week-menu-maker-grocery-items";
const weekMenuStateKey = "default-week-menu";
const supabaseConfig = window.WEEK_MENU_SUPABASE_CONFIG ?? {};
const supabaseUrl = supabaseConfig.supabaseUrl ?? "";
const supabaseAnonKey = supabaseConfig.supabaseAnonKey ?? "";
const isSupabaseConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("PASTE_YOUR_SUPABASE_URL_HERE") &&
  !supabaseAnonKey.includes("PASTE_YOUR_SUPABASE_ANON_KEY_HERE");

const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const menuDays = [
  "Day 1",
  "Day 2",
  "Day 3",
];

const starterRecipes = [
  {
    id: crypto.randomUUID(),
    name: "Lemon Chicken Tray Bake",
    ingredients: ["Chicken", "Potatoes", "Lemon", "Garlic", "Rosemary"],
  },
  {
    id: crypto.randomUUID(),
    name: "Veggie Stir-Fry",
    ingredients: ["Noodles", "Bell pepper", "Broccoli", "Soy sauce", "Ginger"],
  },
  {
    id: crypto.randomUUID(),
    name: "Creamy Tomato Pasta",
    ingredients: ["Pasta", "Tomatoes", "Cream", "Parmesan", "Basil"],
  },
];

let recipes = [];
let currentMenuRecipeIds = [];
let includedGroceryRecipeIds = [];
let groceryItems = [];
let editingRecipeId = null;
let usesSupabaseForWeekMenu = Boolean(supabaseClient);
let usesSupabaseForGroceries = Boolean(supabaseClient);
let groceryFiltersOpen = false;
let isMissingRecipeSourceColumns = false;

function showAppBlock(blockId) {
  appBlocks.forEach((block) => {
    const isActive = block.id === blockId;
    block.hidden = !isActive;
    block.classList.toggle("is-active", isActive);
  });

  blockTabs.forEach((tab) => {
    const isActive = tab.dataset.blockTarget === blockId;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function renderMenuChooser() {
  menuChooserStatus.textContent = "";

  if (recipes.length === 0) {
    menuChooserList.innerHTML =
      '<p class="empty-state">Add recipes before choosing a menu.</p>';
    return;
  }

  const selectedIds = new Set(currentMenuRecipeIds.map(String));

  menuChooserList.innerHTML = recipes
    .map(
      (recipe) => `
        <label class="menu-chooser-option">
          <input
            type="checkbox"
            name="menuRecipe"
            value="${escapeHtml(String(recipe.id))}"
            ${selectedIds.has(String(recipe.id)) ? "checked" : ""}
          />
          <span>${escapeHtml(recipe.name)}</span>
        </label>
      `
    )
    .join("");
}

function openMenuChooser() {
  renderMenuChooser();
  syncMenuChooserLimit();
  menuChooserModal.hidden = false;
}

function closeMenuChooser() {
  menuChooserModal.hidden = true;
}

function syncMenuChooserLimit() {
  const checkedInputs = [
    ...menuChooserForm.querySelectorAll("input[name='menuRecipe']:checked"),
  ];
  const uncheckedInputs = [
    ...menuChooserForm.querySelectorAll("input[name='menuRecipe']:not(:checked)"),
  ];
  const isAtLimit = checkedInputs.length >= menuDays.length;

  uncheckedInputs.forEach((input) => {
    input.disabled = isAtLimit;
  });

  menuChooserStatus.textContent = isAtLimit
    ? `Maximum ${menuDays.length} recipes selected.`
    : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStorageStatus(message, tone = "info") {
  storageStatus.textContent = message;
  storageStatus.dataset.tone = tone;
}

function setImportStatus(message, tone = "info") {
  importStatus.textContent = message;
  importStatus.dataset.tone = tone;
}

function updateSyncStatus() {
  if (!supabaseClient) {
    setStorageStatus(
      "Using browser storage. Add your Supabase keys to sync recipes and groceries across devices.",
      "warning"
    );
    return;
  }

  if (isMissingRecipeSourceColumns) {
    setStorageStatus(
      "Recipes are syncing, but TikTok links are not because Supabase is missing the source_url/source_provider/source_caption columns. Run the README recipe migration.",
      "warning"
    );
    return;
  }

  if (usesSupabaseForWeekMenu && usesSupabaseForGroceries) {
    setStorageStatus(
      "Recipes, menu, and grocery checklist are saving to Supabase and will sync across devices.",
      "success"
    );
    return;
  }

  setStorageStatus(
    "Recipes sync to Supabase, but the grocery checklist is using this browser until the extra Supabase tables are added.",
    "warning"
  );
}

function loadRecipesFromLocalStorage() {
  const savedRecipes = localStorage.getItem(storageKey);

  if (!savedRecipes) {
    return starterRecipes;
  }

  try {
    const parsedRecipes = JSON.parse(savedRecipes);

    if (!Array.isArray(parsedRecipes)) {
      return starterRecipes;
    }

    return parsedRecipes.filter(isValidRecipeShape);
  } catch {
    return starterRecipes;
  }
}

function saveRecipesToLocalStorage() {
  localStorage.setItem(storageKey, JSON.stringify(recipes));
}

function loadWeekMenuFromLocalStorage() {
  const savedWeekMenu = localStorage.getItem(menuStorageKey);

  if (!savedWeekMenu) {
    return [];
  }

  try {
    const parsedMenu = JSON.parse(savedWeekMenu);
    return Array.isArray(parsedMenu) ? parsedMenu.map(String) : [];
  } catch {
    return [];
  }
}

function saveWeekMenuToLocalStorage() {
  localStorage.setItem(menuStorageKey, JSON.stringify(currentMenuRecipeIds));
  localStorage.setItem(
    includedRecipesStorageKey,
    JSON.stringify(includedGroceryRecipeIds.map(String))
  );
}

function loadIncludedRecipesFromLocalStorage() {
  const savedIncludedRecipes = localStorage.getItem(includedRecipesStorageKey);

  if (!savedIncludedRecipes) {
    return [];
  }

  try {
    const parsedIncludedRecipes = JSON.parse(savedIncludedRecipes);
    return Array.isArray(parsedIncludedRecipes) ? parsedIncludedRecipes.map(String) : [];
  } catch {
    return [];
  }
}

function loadGroceriesFromLocalStorage() {
  const savedGroceries = localStorage.getItem(groceryStorageKey);

  if (!savedGroceries) {
    return [];
  }

  try {
    const parsedGroceries = JSON.parse(savedGroceries);

    if (!Array.isArray(parsedGroceries)) {
      return [];
    }

    return parsedGroceries.filter(isValidGroceryItemShape);
  } catch {
    return [];
  }
}

function saveGroceriesToLocalStorage() {
  localStorage.setItem(groceryStorageKey, JSON.stringify(groceryItems));
}

function isValidRecipeShape(recipe) {
  return (
    recipe &&
    (typeof recipe.id === "string" || typeof recipe.id === "number") &&
    typeof recipe.name === "string" &&
    Array.isArray(recipe.ingredients)
  );
}

function normalizeRecipe(record) {
  return {
    id: record.id,
    name: record.name,
    ingredients: Array.isArray(record.ingredients) ? record.ingredients : [],
    sourceUrl: record.source_url ?? record.sourceUrl ?? "",
    sourceProvider: record.source_provider ?? record.sourceProvider ?? "",
    sourceCaption: record.source_caption ?? record.sourceCaption ?? "",
  };
}

function getRecipeSignature(recipe) {
  return [
    recipe.name,
    ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : []),
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

function mergeRecipeSourceFromLocal(recipe, localRecipes) {
  if (recipe.sourceUrl) {
    return recipe;
  }

  const localMatch = localRecipes.find((localRecipe) => {
    return (
      localRecipe.sourceUrl &&
      (String(localRecipe.id) === String(recipe.id) ||
        getRecipeSignature(localRecipe) === getRecipeSignature(recipe))
    );
  });

  if (!localMatch) {
    return recipe;
  }

  return {
    ...recipe,
    sourceUrl: localMatch.sourceUrl,
    sourceProvider: localMatch.sourceProvider,
    sourceCaption: localMatch.sourceCaption,
  };
}

function upsertRecipeInState(recipeToSave) {
  const normalizedRecipe = normalizeRecipe(recipeToSave);
  const existingRecipeIndex = recipes.findIndex(
    (recipe) => String(recipe.id) === String(normalizedRecipe.id)
  );

  if (existingRecipeIndex === -1) {
    recipes = [normalizedRecipe, ...recipes];
  } else {
    recipes = recipes.map((recipe) =>
      String(recipe.id) === String(normalizedRecipe.id) ? normalizedRecipe : recipe
    );
  }

  saveRecipesToLocalStorage();
}

function isValidGroceryItemShape(item) {
  return (
    item &&
    typeof item.key === "string" &&
    typeof item.name === "string" &&
    Number.isInteger(item.count) &&
    typeof item.checked === "boolean" &&
    (item.sourceType === undefined || typeof item.sourceType === "string")
  );
}

function normalizeGroceryItem(record) {
  return {
    key: String(record.item_key ?? record.key),
    name: String(record.ingredient_name ?? record.name),
    count: Number(record.item_count ?? record.count ?? 1),
    checked: Boolean(record.checked),
    sourceType: String(record.source_type ?? record.sourceType ?? "generated"),
    sourceRecipeId:
      record.source_recipe_id ?? record.sourceRecipeId
        ? String(record.source_recipe_id ?? record.sourceRecipeId)
        : null,
    sourceRecipeName:
      record.source_recipe_name ?? record.sourceRecipeName
        ? String(record.source_recipe_name ?? record.sourceRecipeName)
        : null,
  };
}

async function loadRecipes() {
  if (!supabaseClient) {
    recipes = loadRecipesFromLocalStorage();
    return;
  }

  const { data, error } = await supabaseClient
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    recipes = loadRecipesFromLocalStorage();
    usesSupabaseForWeekMenu = false;
    usesSupabaseForGroceries = false;
    setStorageStatus("Could not connect to Supabase, so the app switched to browser storage.", "error");
    console.error(error);
    return;
  }

  const localRecipes = loadRecipesFromLocalStorage();
  const hasSourceColumns =
    data.length === 0 ||
    data.some(
      (record) =>
        Object.prototype.hasOwnProperty.call(record, "source_url") ||
        Object.prototype.hasOwnProperty.call(record, "source_provider") ||
        Object.prototype.hasOwnProperty.call(record, "source_caption")
    );
  isMissingRecipeSourceColumns = !hasSourceColumns;

  recipes = data
    .map(normalizeRecipe)
    .map((recipe) => mergeRecipeSourceFromLocal(recipe, localRecipes));
  saveRecipesToLocalStorage();

  updateSyncStatus();
}

async function loadWeekMenuState() {
  if (!supabaseClient || !usesSupabaseForWeekMenu) {
    currentMenuRecipeIds = loadWeekMenuFromLocalStorage();
    includedGroceryRecipeIds = loadIncludedRecipesFromLocalStorage();
    usesSupabaseForWeekMenu = false;
    return;
  }

  const { data, error } = await supabaseClient
    .from("week_menu_state")
    .select("*")
    .eq("singleton_key", weekMenuStateKey)
    .maybeSingle();

  if (error) {
    currentMenuRecipeIds = loadWeekMenuFromLocalStorage();
    includedGroceryRecipeIds = loadIncludedRecipesFromLocalStorage();
    usesSupabaseForWeekMenu = false;
    console.error(error);
    return;
  }

  currentMenuRecipeIds = Array.isArray(data?.recipe_ids) ? data.recipe_ids.map(String) : [];
  includedGroceryRecipeIds = Array.isArray(data?.included_grocery_recipe_ids)
    ? data.included_grocery_recipe_ids.map(String)
    : [...currentMenuRecipeIds];
}

async function saveWeekMenuState() {
  if (!supabaseClient || !usesSupabaseForWeekMenu) {
    saveWeekMenuToLocalStorage();
    return;
  }

  const { error } = await supabaseClient.from("week_menu_state").upsert(
    {
      singleton_key: weekMenuStateKey,
      recipe_ids: currentMenuRecipeIds.map(String),
      included_grocery_recipe_ids: includedGroceryRecipeIds.map(String),
    },
    {
      onConflict: "singleton_key",
    }
  );

  if (error) {
    usesSupabaseForWeekMenu = false;
    saveWeekMenuToLocalStorage();
    setStorageStatus(
      "Supabase needs the latest week menu columns before grocery filters can sync. Run the README migration.",
      "error"
    );
    console.error(error);
  }
}

async function loadGroceryItems() {
  if (!supabaseClient || !usesSupabaseForGroceries) {
    groceryItems = loadGroceriesFromLocalStorage();
    usesSupabaseForGroceries = false;
    return;
  }

  const { data, error } = await supabaseClient
    .from("grocery_checklist_items")
    .select("*")
    .order("ingredient_name", { ascending: true });

  if (error) {
    groceryItems = loadGroceriesFromLocalStorage();
    usesSupabaseForGroceries = false;
    console.error(error);
    return;
  }

  groceryItems = data.map(normalizeGroceryItem);
}

async function saveGroceryItems() {
  if (!supabaseClient || !usesSupabaseForGroceries) {
    saveGroceriesToLocalStorage();
    return;
  }

  const { error: deleteError } = await supabaseClient
    .from("grocery_checklist_items")
    .delete()
    .neq("item_key", "");

  if (deleteError) {
    usesSupabaseForGroceries = false;
    saveGroceriesToLocalStorage();
    setStorageStatus(
      "Supabase needs the latest grocery columns before manual items can sync. Run the README migration.",
      "error"
    );
    console.error(deleteError);
    return;
  }

  if (groceryItems.length === 0) {
    return;
  }

  const payload = groceryItems.map((item) => ({
    item_key: item.key,
    ingredient_name: item.name,
    item_count: item.count,
    checked: item.checked,
    label: formatGroceryLabel(item),
    source_type: item.sourceType ?? "generated",
    source_recipe_id: item.sourceRecipeId,
    source_recipe_name: item.sourceRecipeName,
  }));

  const { error: insertError } = await supabaseClient
    .from("grocery_checklist_items")
    .insert(payload);

  if (insertError) {
    usesSupabaseForGroceries = false;
    saveGroceriesToLocalStorage();
    setStorageStatus(
      "Supabase needs the latest grocery columns before manual items can sync. Run the README migration.",
      "error"
    );
    console.error(insertError);
  }
}

const ingredientQuantityStartPattern =
  "(?:\\d+(?:[./]\\d+)?|[\\u00bc\\u00bd\\u00be\\u2153\\u2154\\u215b\\u215c\\u215d\\u215e])";

function splitIngredientText(rawIngredients) {
  const quantityRegex = new RegExp(`(\\S)\\s+(?=${ingredientQuantityStartPattern})`, "gi");

  return rawIngredients
    .replace(/[\u2022\u00b7]/g, "\n")
    .replace(/\s[-\u2013\u2014]\s/g, "\n")
    .replace(quantityRegex, "$1\n")
    .split(/\n|,|;/);
}

function parseIngredients(rawIngredients) {
  return splitIngredientText(rawIngredients)
    .map((ingredient) => normalizeIngredientText(ingredient))
    .filter(Boolean);
}

function getSocialProvider(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (host.includes("instagram.com")) {
      return "Instagram";
    }

    if (host.includes("tiktok.com")) {
      return "TikTok";
    }

    return "Video";
  } catch {
    return "Video";
  }
}

function isAllowedSocialUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const isSupportedHost = host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com");

    return ["http:", "https:"].includes(parsedUrl.protocol) && isSupportedHost;
  } catch {
    return false;
  }
}

function updateImportProviderBadge() {
  const provider = socialImportUrlInput.value.trim()
    ? getSocialProvider(socialImportUrlInput.value.trim())
    : "Paste link";
  importProviderBadge.textContent = provider;
}

function cleanRecipeText(text) {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#[\w-]+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/[\u2022\u00b7]/g, "\n")
    .replace(/\s[-\u2013\u2014]\s/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function titleFromCaption(caption, provider) {
  const cleanedCaption = cleanRecipeText(caption);
  const firstLine = cleanedCaption
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return `${provider} Recipe Draft`;
  }

  return firstLine
    .replace(/^(recipe|dinner|lunch|breakfast)\s*[:|-]\s*/i, "")
    .split(/[.!?]/)[0]
    .trim()
    .slice(0, 80) || `${provider} Recipe Draft`;
}

function normalizeIngredientText(line) {
  return line
    .replace(/^[\s*_\-+•·]+/, "")
    .replace(/^(?:\d+[.)]\s*)/, "")
    .replace(/\*\*/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.|/\\-]+|[\s:;,.|/\\-]+$/g, "")
    .trim();
}

function normalizeDraftIngredient(line) {
  return normalizeIngredientText(
    line.replace(/^(ingredients?|you need|what you need|for the)\s*[:|-]\s*/i, "")
  );
}

function extractIngredientCandidates(caption) {
  const cleanedCaption = cleanRecipeText(caption);
  const lines = cleanedCaption
    .split("\n")
    .map((line) => normalizeDraftIngredient(line))
    .filter(Boolean);
  const ingredientHeadingIndex = lines.findIndex((line) =>
    /^ingredients?$/i.test(line) || /^what you need$/i.test(line)
  );
  const stepHeadingIndex = lines.findIndex((line) =>
    /^(method|steps|directions|instructions)$/i.test(line)
  );

  let candidateText = cleanedCaption;

  if (ingredientHeadingIndex !== -1) {
    const endIndex =
      stepHeadingIndex > ingredientHeadingIndex ? stepHeadingIndex : lines.length;
    candidateText = lines.slice(ingredientHeadingIndex + 1, endIndex).join("\n");
  }

  const splitCandidates = splitIngredientText(candidateText)
    .map((item) => normalizeDraftIngredient(item))
    .filter(Boolean)
    .filter((item) => item.length <= 80)
    .filter((item) => !/^(method|steps|directions|instructions|recipe)$/i.test(item))
    .filter((item) => !/\b(follow|like|save|comment|share|subscribe|link in bio)\b/i.test(item));

  return [...new Set(splitCandidates)].slice(0, 24);
}

function buildSocialRecipeDraft(url, caption) {
  const provider = getSocialProvider(url);
  const ingredients = extractIngredientCandidates(caption);

  return {
    id: crypto.randomUUID(),
    name: titleFromCaption(caption, provider),
    ingredients,
    sourceUrl: url,
    sourceProvider: provider,
    sourceCaption: caption.trim(),
  };
}

async function fetchSocialPreview(url) {
  const provider = getSocialProvider(url);

  if (provider === "TikTok") {
    const response = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
      throw new Error("TikTok preview was not available for this link.");
    }

    const data = await response.json();
    return {
      title: data.title || "TikTok video",
      caption: data.title || "",
      author: data.author_name || "TikTok",
      thumbnailUrl: data.thumbnail_url || "",
      provider,
    };
  }

  if (provider === "Instagram" && supabaseConfig.instagramOembedAccessToken) {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/instagram_oembed?url=${encodeURIComponent(
        url
      )}&access_token=${encodeURIComponent(supabaseConfig.instagramOembedAccessToken)}`
    );

    if (!response.ok) {
      throw new Error("Instagram preview was not available for this link.");
    }

    const data = await response.json();
    return {
      title: data.title || "Instagram video",
      caption: data.title || "",
      author: data.author_name || "Instagram",
      thumbnailUrl: data.thumbnail_url || "",
      provider,
    };
  }

  throw new Error(
    provider === "Instagram"
      ? "Instagram preview needs an oEmbed access token. You can still paste the caption and extract a recipe."
      : "Preview is only available for Instagram or TikTok links."
  );
}

function renderImportPreview(preview) {
  importPreview.hidden = false;
  importPreview.innerHTML = `
    <div class="import-preview-card${preview.thumbnailUrl ? "" : " has-no-thumbnail"}">
      ${
        preview.thumbnailUrl
          ? `<img src="${escapeHtml(preview.thumbnailUrl)}" alt="" />`
          : ""
      }
      <div>
        <h4>${escapeHtml(preview.title)}</h4>
        <p>${escapeHtml(`${preview.provider} by ${preview.author}`)}</p>
      </div>
    </div>
  `;
}

function renderImportDraft(draftRecipe) {
  importDraft.hidden = false;
  importDraft.innerHTML = `
    <form class="import-draft-form" data-import-draft-id="${escapeHtml(draftRecipe.id)}">
      <h4>Review draft</h4>
      <label class="field">
        <span>Recipe name</span>
        <input name="recipeName" type="text" value="${escapeHtml(draftRecipe.name)}" required />
      </label>
      <label class="field">
        <span>Ingredients</span>
        <textarea name="recipeIngredients" rows="5" required>${escapeHtml(
          draftRecipe.ingredients.join("\n")
        )}</textarea>
      </label>
      <div class="import-draft-actions">
        <button class="secondary-button" type="submit">Save Draft</button>
        <button class="ghost-button" type="button" data-fill-manual-recipe>Move to Form</button>
        <a class="ghost-button" href="${escapeHtml(draftRecipe.sourceUrl)}" target="_blank" rel="noreferrer">Open Source</a>
      </div>
    </form>
  `;
  importDraft.dataset.sourceUrl = draftRecipe.sourceUrl;
  importDraft.dataset.sourceProvider = draftRecipe.sourceProvider;
  importDraft.dataset.sourceCaption = draftRecipe.sourceCaption;
}

function shuffleRecipes(recipeArray) {
  const shuffled = [...recipeArray];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function normalizeIngredientName(ingredient) {
  return ingredient.replace(/\s+/g, " ").trim();
}

function buildIngredientKey(ingredient) {
  return normalizeIngredientName(ingredient).toLowerCase();
}

function formatGroceryLabel(item) {
  return item.count > 1 ? `${item.name} x ${item.count}` : item.name;
}

function getIncludedMenuRecipes() {
  const includedIds = new Set(includedGroceryRecipeIds.map(String));
  return getMenuRecipesFromIds(currentMenuRecipeIds).filter((recipe) =>
    includedIds.has(String(recipe.id))
  );
}

function sortGroceryItems(itemList) {
  return [...itemList].sort((firstItem, secondItem) => {
    if (firstItem.sourceType !== secondItem.sourceType) {
      return firstItem.sourceType === "manual" ? -1 : 1;
    }

    return firstItem.name.localeCompare(secondItem.name);
  });
}

function buildManualGroceryItem(name, existingItem = null) {
  const normalizedName = normalizeIngredientName(name);

  return {
    key: existingItem?.key ?? `manual:${crypto.randomUUID()}`,
    name: normalizedName,
    count: 1,
    checked: existingItem?.checked ?? false,
    sourceType: "manual",
    sourceRecipeId: null,
    sourceRecipeName: null,
  };
}

function buildGeneratedGroceryItems(menuRecipes, existingItems = []) {
  const counts = new Map();
  const checkedByKey = new Map(
    existingItems
      .filter((item) => item.sourceType !== "manual")
      .map((item) => [item.key, item.checked])
  );

  for (const recipe of menuRecipes) {
    for (const ingredient of recipe.ingredients) {
      const normalizedName = normalizeIngredientName(ingredient);

      if (!normalizedName) {
        continue;
      }

      const key = buildIngredientKey(normalizedName);
      const existingEntry = counts.get(key);

      if (existingEntry) {
        existingEntry.count += 1;
        continue;
      }

      counts.set(key, {
        key,
        name: normalizedName,
        count: 1,
        checked: checkedByKey.get(key) ?? false,
        sourceType: "generated",
        sourceRecipeId: null,
        sourceRecipeName: null,
      });
    }
  }

  return [...counts.values()];
}

function rebuildGroceryItems(menuRecipes, existingItems = groceryItems) {
  const manualItems = existingItems
    .filter((item) => item.sourceType === "manual")
    .map((item) => buildManualGroceryItem(item.name, item));

  return sortGroceryItems([
    ...manualItems,
    ...buildGeneratedGroceryItems(menuRecipes, existingItems),
  ]);
}

function syncIncludedRecipeIdsWithMenu() {
  const currentIds = new Set(currentMenuRecipeIds.map(String));

  if (currentIds.size === 0) {
    includedGroceryRecipeIds = [];
    return;
  }

  const nextIncludedIds = includedGroceryRecipeIds.filter((recipeId) =>
    currentIds.has(String(recipeId))
  );

  includedGroceryRecipeIds =
    nextIncludedIds.length > 0 ? nextIncludedIds : [...currentMenuRecipeIds];
}

function updateRecipeCount() {
  recipeCount.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`;
}

function updateGroceryCount() {
  groceryCount.textContent = `${groceryItems.length} item${groceryItems.length === 1 ? "" : "s"}`;
}

function renderRecipes() {
  if (recipes.length === 0) {
    recipeList.innerHTML =
      '<p class="empty-state">No recipes yet. Add your first one above.</p>';
    updateRecipeCount();
    return;
  }

  recipeList.innerHTML = recipes
    .map((recipe) => {
      const isEditing = String(recipe.id) === String(editingRecipeId);

      if (isEditing) {
        return `
        <article class="recipe-card">
          <form class="edit-recipe-form" data-edit-form-id="${escapeHtml(String(recipe.id))}">
            <div class="recipe-card-header">
              <div>
                <h4>Edit recipe</h4>
              </div>
              <button
                class="ghost-button"
                type="button"
                data-cancel-id="${escapeHtml(String(recipe.id))}"
              >
                Cancel
              </button>
            </div>
            <label class="field">
              <span>Recipe name</span>
              <input
                name="recipeName"
                type="text"
                value="${escapeHtml(recipe.name)}"
                required
              />
            </label>
            <label class="field">
              <span>Ingredients</span>
              <textarea
                name="recipeIngredients"
                rows="4"
                required
              >${escapeHtml(recipe.ingredients.join("\n"))}</textarea>
            </label>
            <div class="edit-actions">
	              <button
	                class="secondary-button"
	                type="submit"
	                data-save-id="${escapeHtml(String(recipe.id))}"
	              >
	                Save
	              </button>
	            </div>
	          </form>
	        </article>
	      `;
      }

      return `
        <article class="recipe-card">
          <div class="recipe-card-header">
            <div>
              <h4>${escapeHtml(recipe.name)}</h4>
              ${
                recipe.sourceUrl
                  ? `<a class="source-link" href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(recipe.sourceProvider || "Source video")}</a>`
                  : ""
              }
            </div>
            <div>
              <button
                class="ghost-button"
                type="button"
                data-edit-id="${escapeHtml(String(recipe.id))}"
              >
                Edit
              </button>
              <button
                class="ghost-button"
                type="button"
                data-remove-id="${escapeHtml(String(recipe.id))}"
              >
                Remove
              </button>
            </div>
          </div>
          <ul class="ingredient-list">
            ${recipe.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");

  updateRecipeCount();
}

function renderWeekMenu(menuRecipes) {
  weekMenu.innerHTML = menuRecipes
    .map(
      (recipe, index) => `
        <article class="day-card" data-day-index="${index}" title="Click to reshuffle this dish">
          <div class="day-card-header">
            <div>
              <div class="day-label">${menuDays[index]}</div>
              <h4>${escapeHtml(recipe.name)}</h4>
            </div>
          </div>
          <p>${recipe.ingredients.map(escapeHtml).join(", ")}</p>
        </article>
      `
    )
    .join("");
}

function renderWeekMenuCard(slotIndex, recipe) {
  const dayCard = weekMenu.querySelector(`[data-day-index="${slotIndex}"]`);

  if (!dayCard) {
    return;
  }

  dayCard.innerHTML = `
    <div class="day-card-header">
      <div>
        <div class="day-label">${menuDays[slotIndex]}</div>
        <h4>${escapeHtml(recipe.name)}</h4>
      </div>
    </div>
    <p>${recipe.ingredients.map(escapeHtml).join(", ")}</p>
  `;
}

function renderGroceryRecipeFilters() {
  const menuRecipes = getMenuRecipesFromIds(currentMenuRecipeIds);

  if (menuRecipes.length === 0) {
    groceryRecipeFilters.innerHTML =
      '<p class="empty-state">Pick recipes to include after you make a menu.</p>';
    return;
  }

  const includedIds = new Set(includedGroceryRecipeIds.map(String));

  groceryRecipeFilters.innerHTML = `
    <div class="grocery-filter-header">
      <h4>Include recipes</h4>
      <p>Uncheck any recipe you do not want in the grocery list.</p>
    </div>
    <div class="grocery-filter-list">
      ${menuRecipes
        .map(
          (recipe, index) => `
            <label class="grocery-filter-chip">
              <input
                type="checkbox"
                data-grocery-recipe-id="${escapeHtml(String(recipe.id))}"
                ${includedIds.has(String(recipe.id)) ? "checked" : ""}
              />
              <span>${escapeHtml(`${menuDays[index]}: ${recipe.name}`)}</span>
            </label>
          `
        )
        .join("")}
    </div>
  `;
}

function syncGroceryFilterVisibility() {
  groceryRecipeFilters.hidden = !groceryFiltersOpen;
  groceryFilterToggle.setAttribute("aria-expanded", String(groceryFiltersOpen));
  groceryFilterToggle.setAttribute(
    "aria-label",
    groceryFiltersOpen ? "Hide recipe filters" : "Show recipe filters"
  );
}

function renderGroceryList() {
  if (groceryItems.length === 0) {
    groceryList.innerHTML =
      '<p class="empty-state">Your grocery list will appear here after the 3 day menu is generated.</p>';
    updateGroceryCount();
    return;
  }

  groceryList.innerHTML = groceryItems
    .map(
      (item) => `
        <div class="grocery-item${item.checked ? " is-checked" : ""}">
          <label class="grocery-item-main">
            <input
              class="grocery-checkbox"
              type="checkbox"
              data-grocery-key="${escapeHtml(item.key)}"
              ${item.checked ? "checked" : ""}
            />
            <span class="grocery-item-text">${escapeHtml(formatGroceryLabel(item))}</span>
          </label>
          ${
            item.sourceType === "manual"
              ? `<button class="ghost-button grocery-remove-button" type="button" data-remove-grocery-key="${escapeHtml(
                  item.key
                )}">Remove</button>`
              : ""
          }
        </div>
      `
    )
    .join("");

  updateGroceryCount();
}

function getMenuRecipesFromIds(menuRecipeIds) {
  return menuRecipeIds
    .map((recipeId) => recipes.find((recipe) => String(recipe.id) === String(recipeId)))
    .filter(Boolean);
}

function getRandomReplacementRecipe(excludeRecipeId) {
  const candidates = recipes.filter(
    (recipe) => String(recipe.id) !== String(excludeRecipeId)
  );

  if (candidates.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

async function replaceMenuRecipeAtIndex(slotIndex) {
  if (recipes.length <= 1) {
    return;
  }

  const menuRecipes = getMenuRecipesFromIds(currentMenuRecipeIds);
  const currentRecipe = menuRecipes[slotIndex];

  if (!currentRecipe) {
    return;
  }

  const replacementRecipe = getRandomReplacementRecipe(currentRecipe.id);

  if (!replacementRecipe) {
    return;
  }

  const updatedMenuRecipes = [...menuRecipes];
  updatedMenuRecipes[slotIndex] = replacementRecipe;

  currentMenuRecipeIds = updatedMenuRecipes.map((recipe) => String(recipe.id));
  includedGroceryRecipeIds = [...currentMenuRecipeIds];
  groceryItems = rebuildGroceryItems(updatedMenuRecipes, groceryItems);
  renderWeekMenuCard(slotIndex, replacementRecipe);
  renderGroceryRecipeFilters();
  renderGroceryList();
  await saveWeekMenuState();
  await saveGroceryItems();
  updateSyncStatus();
}

async function syncMenuAndGroceries(menuRecipes) {
  currentMenuRecipeIds = menuRecipes.map((recipe) => String(recipe.id));
  syncIncludedRecipeIdsWithMenu();
  groceryItems = rebuildGroceryItems(getIncludedMenuRecipes(), groceryItems);
  renderWeekMenu(menuRecipes);
  renderGroceryRecipeFilters();
  renderGroceryList();
  await saveWeekMenuState();
  await saveGroceryItems();
  updateSyncStatus();
}

async function buildWeekMenu() {
  if (recipes.length === 0) {
    weekMenu.innerHTML =
      '<p class="empty-state">Please add at least one recipe before making a 3 day menu.</p>';
    currentMenuRecipeIds = [];
    includedGroceryRecipeIds = [];
    groceryItems = [];
    renderGroceryRecipeFilters();
    renderGroceryList();
    await saveWeekMenuState();
    await saveGroceryItems();
    return;
  }

  const shuffledRecipes = shuffleRecipes(recipes);
  const menuRecipes = menuDays.map((_, index) => {
    return shuffledRecipes[index % shuffledRecipes.length];
  });

  await syncMenuAndGroceries(menuRecipes);
}

async function buildChosenMenu(recipeIds) {
  const selectedRecipes = recipeIds
    .map((recipeId) => recipes.find((recipe) => String(recipe.id) === String(recipeId)))
    .filter(Boolean);

  if (selectedRecipes.length === 0) {
    weekMenu.innerHTML =
      '<p class="empty-state">Choose at least one recipe to make a menu.</p>';
    return;
  }

  const menuRecipes = menuDays.map((_, index) => {
    return selectedRecipes[index % selectedRecipes.length];
  });

  await syncMenuAndGroceries(menuRecipes);
}

async function renderSavedMenuOrBuildOne() {
  const storedMenuRecipes = getMenuRecipesFromIds(currentMenuRecipeIds);

  if (storedMenuRecipes.length === currentMenuRecipeIds.length && storedMenuRecipes.length > 0) {
    syncIncludedRecipeIdsWithMenu();
    groceryItems = rebuildGroceryItems(getIncludedMenuRecipes(), groceryItems);
    renderWeekMenu(storedMenuRecipes);
    renderGroceryRecipeFilters();
    renderGroceryList();
    updateSyncStatus();
    return;
  }

  await buildWeekMenu();
}

async function toggleGroceryItem(itemKey, checked) {
  groceryItems = groceryItems.map((item) =>
    item.key === itemKey ? { ...item, checked } : item
  );
  renderGroceryList();
  await saveGroceryItems();
  updateSyncStatus();
}

async function setIncludedRecipes(recipeIds) {
  includedGroceryRecipeIds = recipeIds.map(String);
  groceryItems = rebuildGroceryItems(getIncludedMenuRecipes(), groceryItems);
  renderGroceryRecipeFilters();
  renderGroceryList();
  await saveWeekMenuState();
  await saveGroceryItems();
  updateSyncStatus();
}

async function addManualGroceryItem(name) {
  const normalizedName = normalizeIngredientName(name);

  if (!normalizedName) {
    return;
  }

  const existingManualItem = groceryItems.find(
    (item) =>
      item.sourceType === "manual" &&
      normalizeIngredientName(item.name).toLowerCase() === normalizedName.toLowerCase()
  );

  if (existingManualItem) {
    groceryItems = groceryItems.map((item) =>
      item.key === existingManualItem.key
        ? { ...item, checked: false, name: normalizedName }
        : item
    );
  } else {
    groceryItems = sortGroceryItems([
      buildManualGroceryItem(normalizedName),
      ...groceryItems,
    ]);
  }

  renderGroceryList();
  await saveGroceryItems();
  updateSyncStatus();
}

async function removeManualGroceryItem(itemKey) {
  groceryItems = groceryItems.filter((item) => item.key !== itemKey);
  renderGroceryList();
  await saveGroceryItems();
  updateSyncStatus();
}

async function addRecipe(recipe) {
  if (!supabaseClient) {
    upsertRecipeInState(recipe);
    return;
  }

  const recipePayload = {
    name: recipe.name,
    ingredients: recipe.ingredients,
    source_url: recipe.sourceUrl || null,
    source_provider: recipe.sourceProvider || null,
    source_caption: recipe.sourceCaption || null,
  };

  let { data, error } = await supabaseClient
    .from("recipes")
    .insert(recipePayload)
    .select("*")
    .single();

  if (error) {
    const fallbackResponse = await supabaseClient
      .from("recipes")
      .insert({
        name: recipe.name,
        ingredients: recipe.ingredients,
      })
      .select("*")
      .single();

    data = fallbackResponse.data;
    error = fallbackResponse.error;

    if (error) {
      setStorageStatus(
        "Supabase save failed. Check your table setup in the README steps below.",
        "error"
      );
      throw error;
    }

    isMissingRecipeSourceColumns = true;
    setStorageStatus(
      "Recipe saved, but the TikTok link could not sync because Supabase is missing the source columns. Run the README recipe migration.",
      "warning"
    );
  }

  upsertRecipeInState({
    ...data,
    sourceUrl: data.source_url ?? recipe.sourceUrl ?? "",
    sourceProvider: data.source_provider ?? recipe.sourceProvider ?? "",
    sourceCaption: data.source_caption ?? recipe.sourceCaption ?? "",
  });
}

async function updateRecipe(updatedRecipe) {
  if (!supabaseClient) {
    upsertRecipeInState(updatedRecipe);
    return;
  }

  const foundRecipe = recipes.find(
    (recipe) => String(recipe.id) === String(updatedRecipe.id)
  );
  const targetId = foundRecipe ? foundRecipe.id : updatedRecipe.id;

  const recipePayload = {
    name: updatedRecipe.name,
    ingredients: updatedRecipe.ingredients,
    source_url: updatedRecipe.sourceUrl || null,
    source_provider: updatedRecipe.sourceProvider || null,
    source_caption: updatedRecipe.sourceCaption || null,
  };

  let { data, error } = await supabaseClient
    .from("recipes")
    .update(recipePayload)
    .eq("id", targetId)
    .select("*")
    .single();

  if (error) {
    const fallbackResponse = await supabaseClient
      .from("recipes")
      .update({
        name: updatedRecipe.name,
        ingredients: updatedRecipe.ingredients,
      })
      .eq("id", targetId)
      .select("*")
      .single();

    data = fallbackResponse.data;
    error = fallbackResponse.error;

    if (error) {
      setStorageStatus(
        "Supabase blocked recipe edits. Add an UPDATE policy for the recipes table, then try again.",
        "error"
      );
      throw error;
    }

    isMissingRecipeSourceColumns = true;
  }

  upsertRecipeInState({
    ...data,
    sourceUrl: data.source_url ?? updatedRecipe.sourceUrl ?? "",
    sourceProvider: data.source_provider ?? updatedRecipe.sourceProvider ?? "",
    sourceCaption: data.source_caption ?? updatedRecipe.sourceCaption ?? "",
  });
  setStorageStatus("Recipe edits saved to Supabase.", "success");
}

async function removeRecipe(recipeId) {
  if (!supabaseClient) {
    recipes = recipes.filter((recipe) => String(recipe.id) !== String(recipeId));
    saveRecipesToLocalStorage();
    return;
  }

  const foundRecipe = recipes.find(
    (recipe) => String(recipe.id) === String(recipeId)
  );
  const targetId = foundRecipe ? foundRecipe.id : recipeId;

  const { error } = await supabaseClient.from("recipes").delete().eq("id", targetId);

  if (error) {
    setStorageStatus("Supabase delete failed. Please try again.", "error");
    throw error;
  }

  recipes = recipes.filter((recipe) => String(recipe.id) !== String(recipeId));
  saveRecipesToLocalStorage();
}

async function submitEditedRecipeForm(form) {
  const recipeId = form.dataset.editFormId;
  const nameInput = form.querySelector("input[name='recipeName']");
  const ingredientsInput = form.querySelector("textarea[name='recipeIngredients']");

  if (!recipeId || !nameInput || !ingredientsInput) {
    return;
  }

  const name = nameInput.value.trim();
  const ingredients = parseIngredients(ingredientsInput.value);

  if (!name || ingredients.length === 0) {
    form.reportValidity();
    return;
  }

  const updatedRecipe = {
    id: recipeId,
    name,
    ingredients,
    sourceUrl: recipes.find((recipe) => String(recipe.id) === String(recipeId))?.sourceUrl ?? "",
    sourceProvider:
      recipes.find((recipe) => String(recipe.id) === String(recipeId))?.sourceProvider ?? "",
    sourceCaption:
      recipes.find((recipe) => String(recipe.id) === String(recipeId))?.sourceCaption ?? "",
  };

  await updateRecipe(updatedRecipe);
  editingRecipeId = null;
  renderRecipes();

  const currentMenuRecipes = getMenuRecipesFromIds(currentMenuRecipeIds);

  if (currentMenuRecipes.some((recipe) => String(recipe.id) === String(recipeId))) {
    await syncMenuAndGroceries(currentMenuRecipes);
  }
}

socialImportUrlInput.addEventListener("input", updateImportProviderBadge);

fetchPreviewButton.addEventListener("click", async () => {
  const url = socialImportUrlInput.value.trim();

  if (!url) {
    socialImportForm.reportValidity();
    return;
  }

  if (!isAllowedSocialUrl(url)) {
    setImportStatus("Use a full Instagram or TikTok video link.", "error");
    return;
  }

  setImportStatus("Fetching preview...");

  try {
    const preview = await fetchSocialPreview(url);
    renderImportPreview(preview);
    if (!socialImportCaptionInput.value.trim() && preview.caption) {
      socialImportCaptionInput.value = preview.caption;
    }
    setImportStatus("Preview fetched. Paste the caption or transcript, then extract a draft.", "success");
  } catch (error) {
    importPreview.hidden = true;
    importPreview.innerHTML = "";
    setImportStatus(error.message, "error");
  }
});

socialImportForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = socialImportUrlInput.value.trim();
  const caption = socialImportCaptionInput.value.trim();

  if (!url || !caption || !isAllowedSocialUrl(url)) {
    setImportStatus(
      "Paste a full Instagram or TikTok link plus the caption, transcript, or visible ingredients.",
      "error"
    );
    socialImportForm.reportValidity();
    return;
  }

  const draftRecipe = buildSocialRecipeDraft(url, caption);

  if (draftRecipe.ingredients.length === 0) {
    setImportStatus(
      "I could not find ingredients yet. Add the ingredient lines to the caption box and try again.",
      "error"
    );
    return;
  }

  renderImportDraft(draftRecipe);
  setImportStatus("Draft ready. Review it before saving.", "success");
});

importDraft.addEventListener("click", (event) => {
  const fillButton = event.target.closest("[data-fill-manual-recipe]");

  if (!fillButton) {
    return;
  }

  const form = fillButton.closest("[data-import-draft-id]");
  const nameInput = form?.querySelector("input[name='recipeName']");
  const ingredientsInput = form?.querySelector("textarea[name='recipeIngredients']");

  if (!nameInput || !ingredientsInput) {
    return;
  }

  recipeNameInput.value = nameInput.value;
  recipeIngredientsInput.value = ingredientsInput.value;
  recipeNameInput.focus();
});

importDraft.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-import-draft-id]");

  if (!form) {
    return;
  }

  event.preventDefault();

  const nameInput = form.querySelector("input[name='recipeName']");
  const ingredientsInput = form.querySelector("textarea[name='recipeIngredients']");
  const name = nameInput.value.trim();
  const ingredients = parseIngredients(ingredientsInput.value);

  if (!name || ingredients.length === 0) {
    form.reportValidity();
    return;
  }

  try {
    await addRecipe({
      id: form.dataset.importDraftId,
      name,
      ingredients,
      sourceUrl: importDraft.dataset.sourceUrl ?? "",
      sourceProvider: importDraft.dataset.sourceProvider ?? "",
      sourceCaption: importDraft.dataset.sourceCaption ?? "",
    });
    renderRecipes();
    await buildWeekMenu();
    socialImportForm.reset();
    importDraft.hidden = true;
    importDraft.innerHTML = "";
    importPreview.hidden = true;
    importPreview.innerHTML = "";
    updateImportProviderBadge();
    setImportStatus("Recipe saved from video draft.", "success");
  } catch (error) {
    console.error(error);
    setImportStatus("Could not save this draft yet. Check storage status above.", "error");
  }
});

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = recipeNameInput.value.trim();
  const ingredients = parseIngredients(recipeIngredientsInput.value);

  if (!name || ingredients.length === 0) {
    return;
  }

  const draftRecipe = {
    id: crypto.randomUUID(),
    name,
    ingredients,
  };

  try {
    await addRecipe(draftRecipe);
    renderRecipes();
    await buildWeekMenu();
    recipeForm.reset();
    recipeNameInput.focus();
  } catch (error) {
    console.error(error);
  }
});

recipeList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-id]");
  const editButton = event.target.closest("[data-edit-id]");
  const cancelButton = event.target.closest("[data-cancel-id]");
  const saveButton = event.target.closest("[data-save-id]");

  if (removeButton) {
    try {
      await removeRecipe(removeButton.dataset.removeId);
      editingRecipeId = null;
      renderRecipes();
      await buildWeekMenu();
    } catch (error) {
      console.error(error);
    }

    return;
  }

  if (editButton) {
    editingRecipeId = editButton.dataset.editId;
    renderRecipes();
    return;
  }

  if (cancelButton) {
    editingRecipeId = null;
    renderRecipes();
    return;
  }

  if (saveButton) {
    event.preventDefault();

    const form = saveButton.closest("[data-edit-form-id]");

    if (!form) {
      return;
    }

    try {
      await submitEditedRecipeForm(form);
    } catch (error) {
      console.error(error);
    }
  }
});

recipeList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-edit-form-id]");

  if (!form) {
    return;
  }

  event.preventDefault();

  try {
    await submitEditedRecipeForm(form);
  } catch (error) {
    console.error(error);
  }
}, true);

blockTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    showAppBlock(tab.dataset.blockTarget);
  });
});

groceryList.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-grocery-key]");

  if (!checkbox) {
    return;
  }

  try {
    await toggleGroceryItem(checkbox.dataset.groceryKey, checkbox.checked);
  } catch (error) {
    console.error(error);
  }
});

groceryRecipeFilters.addEventListener("change", async (event) => {
  const recipeCheckbox = event.target.closest("[data-grocery-recipe-id]");

  if (!recipeCheckbox) {
    return;
  }

  const selectedRecipeIds = [
    ...groceryRecipeFilters.querySelectorAll("[data-grocery-recipe-id]:checked"),
  ].map((input) => input.dataset.groceryRecipeId);

  try {
    await setIncludedRecipes(selectedRecipeIds);
  } catch (error) {
    console.error(error);
  }
});

groceryFilterToggle.addEventListener("click", () => {
  groceryFiltersOpen = !groceryFiltersOpen;
  syncGroceryFilterVisibility();
});

groceryItemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const itemName = groceryItemNameInput.value.trim();

  if (!itemName) {
    groceryItemForm.reportValidity();
    return;
  }

  try {
    await addManualGroceryItem(itemName);
    groceryItemForm.reset();
    groceryItemNameInput.focus();
  } catch (error) {
    console.error(error);
  }
});

groceryList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-grocery-key]");

  if (!removeButton) {
    return;
  }

  try {
    await removeManualGroceryItem(removeButton.dataset.removeGroceryKey);
  } catch (error) {
    console.error(error);
  }
});

weekMenu.addEventListener("click", async (event) => {
  const dayCard = event.target.closest("[data-day-index]");

  if (!dayCard) {
    return;
  }

  const dayIndex = Number(dayCard.dataset.dayIndex);

  if (Number.isNaN(dayIndex) || recipes.length <= 1) {
    return;
  }

  const animationDelay = 320;

  if (dayCard.classList.contains("is-shuffling")) {
    dayCard.classList.remove("is-shuffling");
    void dayCard.offsetWidth;
  }

  dayCard.classList.add("is-shuffling");

  try {
    await new Promise((resolve) => setTimeout(resolve, animationDelay));
    await replaceMenuRecipeAtIndex(dayIndex);
  } catch (error) {
    console.error(error);
  } finally {
    dayCard.classList.remove("is-shuffling");
  }
});

makeMenuButton.addEventListener("click", async () => {
  try {
    await buildWeekMenu();
    showAppBlock("menu-panel");
  } catch (error) {
    console.error(error);
  }
});

chooseMenuButton.addEventListener("click", () => {
  openMenuChooser();
});

closeMenuChooserButton.addEventListener("click", () => {
  closeMenuChooser();
});

menuChooserModal.addEventListener("click", (event) => {
  if (event.target === menuChooserModal) {
    closeMenuChooser();
  }
});

menuChooserForm.addEventListener("change", (event) => {
  if (event.target.matches("input[name='menuRecipe']")) {
    syncMenuChooserLimit();
  }
});

menuChooserForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedRecipeIds = [
    ...menuChooserForm.querySelectorAll("input[name='menuRecipe']:checked"),
  ].map((input) => input.value);

  if (selectedRecipeIds.length === 0) {
    menuChooserStatus.textContent = "Choose at least one recipe.";
    return;
  }

  try {
    await buildChosenMenu(selectedRecipeIds);
    closeMenuChooser();
    showAppBlock("menu-panel");
  } catch (error) {
    console.error(error);
  }
});

async function initializeApp() {
  await loadRecipes();
  await loadWeekMenuState();
  await loadGroceryItems();
  renderRecipes();
  renderGroceryRecipeFilters();
  syncGroceryFilterVisibility();
  renderGroceryList();
  await renderSavedMenuOrBuildOne();
}

initializeApp();
