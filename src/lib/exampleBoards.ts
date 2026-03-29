import { OutfitBoard } from './types'
import { getBudgetCap, getBudgetStatus } from './shopper'

export interface ExampleBoardEntry {
  id: string
  title: string
  kicker: string
  prompt: string
  board: OutfitBoard
}

function withBudget(board: Omit<OutfitBoard, 'budgetCap' | 'budgetRemaining' | 'budgetStatus'>): OutfitBoard {
  const totalPrice = board.products.reduce((sum, product) => sum + product.price, 0)
  const budgetCap = getBudgetCap(board.budgetLabel ?? null)

  return {
    ...board,
    totalPrice,
    budgetCap,
    budgetRemaining: budgetCap ? Number((budgetCap - totalPrice).toFixed(2)) : null,
    budgetStatus: getBudgetStatus(totalPrice, board.budgetLabel ?? null),
  }
}

export const EXAMPLE_BOARDS: ExampleBoardEntry[] = [
  {
    id: 'friday-night-out',
    title: 'Friday Night Out',
    kicker: 'Exact look',
    prompt: 'Build me a Friday night out look with a satin dress and sharp accessories.',
    board: withBudget({
      id: 'friday-night-out',
      title: 'Friday Night Out',
      occasion: 'Cocktail bar booking',
      styleNote: 'A clean satin dress keeps the base sleek, then the heels and jewellery push it into after-dark territory without making it feel overworked.',
      createdAt: '2026-03-29T00:00:00.000Z',
      budgetLabel: '£50–150',
      warnings: ['Stock can move quickly on retailer pages.'],
      products: [
        {
          id: 'example-fno-dress',
          name: 'New Look Women’s Petite Black Satin Slip Midi Dress',
          brand: 'New Look',
          price: 14.99,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTOgBJF7blajEP_F5Nb5sUkGzFsgYmi-nHMPvs7xeHiCAU2953jpMcWbmQbkKxTcid_tnWfJ7Nf9V93DfWJzE8tUABsaaJOmH2_H4QNOzvkxILq9uTaFeGX',
          productUrl: 'https://www.newlook.com/uk/womens/clothing/dresses/petite-black-satin-slip-midi-dress/p/951374801?srsltid=AfmBOoo8K3uJeVPmsDJIITGvb0kG9AbJOs2cpIXvfyYhiQdNbwHaWrT9oCg',
          affiliateUrl: 'https://www.newlook.com/uk/womens/clothing/dresses/petite-black-satin-slip-midi-dress/p/951374801?srsltid=AfmBOoo8K3uJeVPmsDJIITGvb0kG9AbJOs2cpIXvfyYhiQdNbwHaWrT9oCg',
          storeName: 'New Look',
          category: 'dresses',
        },
        {
          id: 'example-fno-heels',
          name: 'New Look Women’s Dark Burgundy Strappy Stiletto Heel Sandals',
          brand: 'New Look',
          price: 27.19,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQxJsSPBIF2Mc4YR5l6aX28djwLBuGrTuDSlU0pkhyeQxJYKlt1ZwmZlFXNghlT3-41jRx5olc2pDP_6gyxbDAd3YHgBxH1u72z3hGjXde90B2QjOx5tEeoz4U',
          productUrl: 'https://www.newlook.com/uk/womens/footwear/shoes/dark-burgundy-strappy-stiletto-heel-sandals/p/929370767?srsltid=AfmBOoqXGKkDUt48ILdxztIEM3qgjo5sNn0Ins_H46uH3di5tTifdWRmSv8',
          affiliateUrl: 'https://www.newlook.com/uk/womens/footwear/shoes/dark-burgundy-strappy-stiletto-heel-sandals/p/929370767?srsltid=AfmBOoqXGKkDUt48ILdxztIEM3qgjo5sNn0Ins_H46uH3di5tTifdWRmSv8',
          storeName: 'New Look',
          category: 'shoes',
        },
        {
          id: 'example-fno-bag',
          name: 'Women’s Joules Edie Bag',
          brand: 'Joules',
          price: 29,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQPS3Cine5yJ6zdBpgkxwFf_3nIddUEODsdCR-iuMBIGNPzOID8S0J1rF9Ctmz84hwJ3d26L5zPI7XIvw0im8putiId9C1rQQShsI6TNJdpU5E-5gMg_qmkLg',
          productUrl: 'https://www.next.co.uk/style/su727028/f34305?srsltid=AfmBOooYf4Q3_axfbmxL9Htpe2lYDMvF_vzzlfMvXd6gt_kCStbGJ1W4njU#f34305?utm_source=google&utm_medium=organic&utm_campaign=organicshopping',
          affiliateUrl: 'https://www.next.co.uk/style/su727028/f34305?srsltid=AfmBOooYf4Q3_axfbmxL9Htpe2lYDMvF_vzzlfMvXd6gt_kCStbGJ1W4njU#f34305?utm_source=google&utm_medium=organic&utm_campaign=organicshopping',
          storeName: 'Next',
          category: 'bags',
        },
        {
          id: 'example-fno-hoops',
          name: 'Astrid & Miyu Essential Upper Lobe Piercing Earrings',
          brand: 'Astrid & Miyu',
          price: 36,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTtfW9yvmY9J4AVPQkdQxHd1l6mmyFqG0ZhTXEok8HYVbymA1oPbi_TyNEju9apiN-vBht4W3BM8jE',
          productUrl: 'https://www.astridandmiyu.com/products/rounded-hoop-6-5mm-in-gold?variant=39599918415930&utm_source=google&utm_medium=shoppingiq&utm_campaign=shoppingiqfeed&utm_content=shoppingseo&srsltid=AfmBOopV9nQgeSIX5Cagpv-neFZpe4nycnGBOiWrTpeUubu7gSryHf5_uV4',
          affiliateUrl: 'https://www.astridandmiyu.com/products/rounded-hoop-6-5mm-in-gold?variant=39599918415930&utm_source=google&utm_medium=shoppingiq&utm_campaign=shoppingiqfeed&utm_content=shoppingseo&srsltid=AfmBOopV9nQgeSIX5Cagpv-neFZpe4nycnGBOiWrTpeUubu7gSryHf5_uV4',
          storeName: 'Astrid & Miyu',
          category: 'accessories',
        },
      ],
    }),
  },
  {
    id: 'summer-wedding-guest',
    title: 'Summer Wedding Guest',
    kicker: 'Exact look',
    prompt: 'Find a summer wedding guest look that feels polished but easy.',
    board: withBudget({
      id: 'summer-wedding-guest',
      title: 'Summer Wedding Guest',
      occasion: 'Outdoor ceremony and drinks',
      styleNote: 'The floral dress does most of the work, then the sandals and satin clutch keep the look wedding-ready without tipping into anything too formal.',
      createdAt: '2026-03-29T00:00:00.000Z',
      budgetLabel: '£50–150',
      warnings: ['Stock can move quickly on retailer pages.'],
      products: [
        {
          id: 'example-swg-dress',
          name: 'Ladies H&M Floral Strappy Midi Dress',
          brand: 'H&M',
          price: 17.49,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcRUCwxnRJZ4DrUhL6J4n9rF36iS_JOfKnE7jZAHuA4gC6slpal9dmBGBKolp3R4QsZWunzWbC3m',
          productUrl: 'https://www2.hm.com/en_gb/productpage.1217048008.html?pr_oyster=coH8DxwouA&srsltid=AfmBOop9NtHQyW2wPceFwWTVU9sEqqjHCmrdWWs4trFO4nRK10-luwGzjHs',
          affiliateUrl: 'https://www2.hm.com/en_gb/productpage.1217048008.html?pr_oyster=coH8DxwouA&srsltid=AfmBOop9NtHQyW2wPceFwWTVU9sEqqjHCmrdWWs4trFO4nRK10-luwGzjHs',
          storeName: 'H&M',
          category: 'dresses',
        },
        {
          id: 'example-swg-shoes',
          name: 'Ravel Women’s Farran Open-Toe Sandals',
          brand: 'Ravel',
          price: 50,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTiihpXZ-dgRiHe67Sw6k4qsj2GgKMRPo06JYaxmU7E5pKbspenThxke8RQOIvvHmCl929L6jxpvIpm_GcHV73kG68ecnEcyBO-6ZWwKOzPwjAcD9jFoNkG6wQ',
          productUrl: 'https://www.johnlewis.com/ravel-farran-block-heel-sandals/pink/p113310846?size=5&utm_source=google&utm_medium=organic&utm_campaign=organicshopping&srsltid=AfmBOorJon85fKLc-ofBg9iN9OTQy7IxOZc-I4taB-I8rtCVBu9Jtm9BwXg',
          affiliateUrl: 'https://www.johnlewis.com/ravel-farran-block-heel-sandals/pink/p113310846?size=5&utm_source=google&utm_medium=organic&utm_campaign=organicshopping&srsltid=AfmBOorJon85fKLc-ofBg9iN9OTQy7IxOZc-I4taB-I8rtCVBu9Jtm9BwXg',
          storeName: 'John Lewis & Partners',
          category: 'shoes',
        },
        {
          id: 'example-swg-bag',
          name: 'Accessorize Women’s Bow Satin Clutch Bag',
          brand: 'Accessorize',
          price: 20,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRn-HO4vdFvQlFXTDkSTDycY24bqduANVnWxdUEZKbvhh4aCAo4hcHI2WazFRnfKEPbQcRh4sgPntNkGMQsCsbTXHyLkPmwwzqlUi37HiEj',
          productUrl: 'https://www.accessorize.com/uk/bow-satin-clutch-bag/1000571313.html?utm_source=google&utm_medium=surfaces&utm_campaign=shopping-feed&utm_content=free-google-shopping-clicks&srsltid=AfmBOoqjItrMA9-BmbE2licDcsjjvbtnSos_4_WIumX3sh_MDMeC25A8P6k',
          affiliateUrl: 'https://www.accessorize.com/uk/bow-satin-clutch-bag/1000571313.html?utm_source=google&utm_medium=surfaces&utm_campaign=shopping-feed&utm_content=free-google-shopping-clicks&srsltid=AfmBOoqjItrMA9-BmbE2licDcsjjvbtnSos_4_WIumX3sh_MDMeC25A8P6k',
          storeName: 'Accessorize',
          category: 'bags',
        },
        {
          id: 'example-swg-earrings',
          name: 'Lunvky 14K Gold Plated Dangle Earrings',
          brand: 'Amazon.co.uk - Amazon.co.uk-Seller',
          price: 9.49,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRWLQmNo_TEb2KvluNSfB4fBX6oZnuArL3QhRQUWzDY3AVg_X52m-YM78CxsHyOlny4cFqwW99ZhyWqsIGuXNGcybpBa7oNZnAF4kXya6XyxXTnZDCxKdliV8yF',
          productUrl: 'https://www.amazon.co.uk/Lunvky-Earrings-Dangling-Bridesmaid-Valentine/dp/B0G1LDYCY7?source=ps-sl-shoppingads-lpcontext&ref_=fplfs&psc=1&smid=AK9PD9O0YGJNT',
          affiliateUrl: 'https://www.amazon.co.uk/Lunvky-Earrings-Dangling-Bridesmaid-Valentine/dp/B0G1LDYCY7?source=ps-sl-shoppingads-lpcontext&ref_=fplfs&psc=1&smid=AK9PD9O0YGJNT',
          storeName: 'Amazon.co.uk',
          category: 'accessories',
        },
      ],
    }),
  },
  {
    id: 'new-job-first-week',
    title: 'New Job, First Week',
    kicker: 'Exact look',
    prompt: 'Create a smart first-week-at-work outfit that still feels relaxed.',
    board: withBudget({
      id: 'new-job-first-week',
      title: 'New Job, First Week',
      occasion: 'Office onboarding week',
      styleNote: 'The blazer gives instant structure, then the softer trouser and tee keep the whole outfit feeling like you rather than corporate costume.',
      createdAt: '2026-03-29T00:00:00.000Z',
      budgetLabel: '£50–150',
      warnings: ['Stock can move quickly on retailer pages.'],
      products: [
        {
          id: 'example-nj-blazer',
          name: 'Women’s Solid Color Professional Regular Fit Long Sleeve Blazer',
          brand: 'LightInTheBox',
          price: 9.59,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTWmKPFirpLl-QpIbQ740u1Kv8gdfxyl0YIGp922TdamJQ6h9tQmcKAXAP6Z097201zwCk4WqUEvMne3yHFGOxVxuH-cmWtyQauHRBhMf_Ki6MFY0DgNH8frA',
          productUrl: 'https://www.amazon.co.uk/Blazers-Women-UK-Cardigan-Business/dp/B0DFQCNKNK?source=ps-sl-shoppingads-lpcontext&ref_=fplfs&psc=1&smid=A2XZDPQGS5F2AG',
          affiliateUrl: 'https://www.amazon.co.uk/Blazers-Women-UK-Cardigan-Business/dp/B0DFQCNKNK?source=ps-sl-shoppingads-lpcontext&ref_=fplfs&psc=1&smid=A2XZDPQGS5F2AG',
          storeName: 'Amazon.co.uk',
          category: 'outerwear',
        },
        {
          id: 'example-nj-trousers',
          name: 'Zara Soft Wide-Leg Trousers',
          brand: 'ZARA',
          price: 27.99,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTfJgLAQqPLy2ydVe25Hq7ccOq2BK9_N-djNF3WznbXNzAjDQOswhJO7GoT8aDmmKgbkCIWdkr1jvMHKfDaX88_NodNtDYsp_rtIlhKpZ4Y2luTU7-4b1qjoxI',
          productUrl: 'https://www.zara.com/uk/en/soft-wide-leg-trousers-p05070156.html?v1=496928892',
          affiliateUrl: 'https://www.zara.com/uk/en/soft-wide-leg-trousers-p05070156.html?v1=496928892',
          storeName: 'Zara',
          category: 'bottoms',
        },
        {
          id: 'example-nj-top',
          name: 'H&M Ladies Ribbed T-Shirt',
          brand: 'H&M',
          price: 6.99,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRcV-TRALU0_Zhc0aZxECzIYFIDAS__CWUTHTrFoMtyYb2j4YEvPSxKp_BqhODj4rYFhvMeJ2iPx8cQHmgsyvLD1oIDZK2yZBObJX5HK2dUju1yt8hU37p5eA',
          productUrl: 'https://www2.hm.com/en_gb/productpage.1260556028.html?srsltid=AfmBOopFU7VCo5M6HYpwRnyiLJI7ZQKHF7oxC0rBidzucZhp_rfT3XGWX8M',
          affiliateUrl: 'https://www2.hm.com/en_gb/productpage.1260556028.html?srsltid=AfmBOopFU7VCo5M6HYpwRnyiLJI7ZQKHF7oxC0rBidzucZhp_rfT3XGWX8M',
          storeName: 'H&M',
          category: 'tops',
        },
        {
          id: 'example-nj-loafers',
          name: 'Clarks Women’s Sarafyna Iris Leather Loafers',
          brand: 'Clarks',
          price: 65,
          currency: 'GBP',
          imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQlj-xWSwRXivKGu6nZX1gqYPqP55GxTBPQDSUWoyfdsbfXa77f8kILWl8fmLCpY74ji7tdt9q2TUQjtxDAsnRiwWaeUQiGiRJhNNRbwYgHq8cvjQDRIYJkYLQ',
          productUrl: 'https://www.clarks.com/en-gb/sarafyna-iris/26179793-p?srsltid=AfmBOorPDJvKHhCZaV5YfYwi52bulL3EDwoB5CvQFaGP0-VvVTplmB1ru34',
          affiliateUrl: 'https://www.clarks.com/en-gb/sarafyna-iris/26179793-p?srsltid=AfmBOorPDJvKHhCZaV5YfYwi52bulL3EDwoB5CvQFaGP0-VvVTplmB1ru34',
          storeName: 'Clarks',
          category: 'shoes',
        },
      ],
    }),
  },
]

export function getExampleBoardById(id: string) {
  return EXAMPLE_BOARDS.find((entry) => entry.id === id)
}
