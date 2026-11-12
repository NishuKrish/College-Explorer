import { expect, test } from "@playwright/test";
const school = { school_id:12,name:"University of California-Los Angeles",city:"Los Angeles",state:"CA",type:"Public",setting:"Urban",enrollment:33000,acceptance_rate:.09,net_price:14013,graduation_rate:.9,fit_score:null,confidence_score:null,top_reasons:[],top_tradeoffs:[] };
test("application checklist, dates and calendar share persisted state", async ({page})=>{
  await page.addInitScript(school=>{
    if (!localStorage.getItem("college-exploration.saved-schools.v1")) localStorage.setItem("college-exploration.saved-schools.v1",JSON.stringify([{...school,status:"interested",saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}]));
  },school);
  await page.goto("/planner");
  const card=page.locator("#application-12");
  await card.getByLabel("Personal essay",{exact:true}).check();
  const now=new Date();const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  await page.getByLabel(`${school.name} application deadline`).fill(date);
  await card.getByRole("combobox").selectOption("In progress");
  await page.reload();
  await expect(card.getByLabel("Personal essay",{exact:true})).toBeChecked();
  await expect(page.getByLabel(`${school.name} application deadline`)).toHaveValue(date);
  await expect(card.getByRole("combobox")).toHaveValue("In progress");
  await page.getByRole("button",{name:"Calendar",exact:true}).click();
  await expect(page.getByText(`${school.name} · Application due`,{exact:true}).first()).toBeVisible();
  await page.getByText(`${school.name} · Application due`,{exact:true}).first().click();
  await expect(card).toBeVisible();
});
test("essay comparison and explicit saved drafts survive reload",async({page})=>{
  await page.route("**/counselor/status",route=>route.fulfill({json:{available:true,model:"openai/gpt-oss-120b",provider:"Groq",source_url:"https://github.com/NishuKrish/College-Explorer"}}));
  await page.goto("/counselor");
  await page.getByRole("button",{name:"Essay studio"}).click();
  const editor=page.getByRole("textbox",{name:"Essay draft",exact:true});
  await editor.fill("I learned by listening.");
  await page.getByRole("button",{name:"Set comparison point"}).click();
  await editor.fill("I learned by listening carefully.");
  await page.getByRole("button",{name:"Compare revisions"}).click();
  await expect(page.getByLabel("Draft changes").locator("ins").last()).toContainText("carefully");
  await page.getByRole("button",{name:"Save on device"}).click();
  await expect(page.getByText("Draft saved on this device.",{exact:false})).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Essay studio"}).click();
  await page.getByRole("button",{name:"Load saved"}).click();
  await expect(editor).toContainText("I learned by listening carefully.");
});
test("campus list supports aliases and shortlist without requesting tiles",async({page})=>{
  let tiles=0;page.on("request",request=>{if(request.url().includes("tile.openstreetmap.org"))tiles++;});
  await page.route("**/schools/search**",route=>route.fulfill({json:{results:[school],total_results:1,page:1,page_size:50}}));
  await page.goto("/campuses");
  await page.getByLabel("Search campuses").fill("UCLA");
  await expect(page.getByText("1 campuses",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:`Save ${school.name}`,exact:true}).click();
  await page.getByRole("button",{name:"My shortlist",exact:true}).click();
  await expect(page.getByRole("button",{name:`Unsave ${school.name}`,exact:true})).toBeVisible();
  expect(tiles).toBe(0);
});
