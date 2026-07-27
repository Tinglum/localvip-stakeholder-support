export const BUSINESS_CATEGORIES = [
  { id: 1, label: 'Food & Beverage' },
  { id: 2, label: 'Health & Beauty' },
  { id: 3, label: 'Entertainment' },
  { id: 4, label: 'Home Services' },
  { id: 5, label: 'Retail' },
  { id: 6, label: 'Other' },
] as const

export type BusinessCategoryId = typeof BUSINESS_CATEGORIES[number]['id']

export interface BusinessKeywordGroup {
  id: string
  label: string
  categoryIds: readonly BusinessCategoryId[]
  keywords: readonly string[]
}

export const BUSINESS_KEYWORD_GROUPS: readonly BusinessKeywordGroup[] = [
  {
    id: 'food-cuisines',
    label: 'Food & cuisines',
    categoryIds: [1],
    keywords: [
      'American', 'Asian fusion', 'Bakery', 'Barbecue', 'Breakfast', 'Brunch', 'Burger', 'Cafe', 'Catering', 'Chinese',
      'Coffee', 'Deli', 'Desserts', 'Donuts', 'Farm-to-table', 'Fast casual', 'Fine dining', 'Food truck', 'French', 'Greek',
      'Ice cream', 'Indian', 'Italian', 'Japanese', 'Korean', 'Latin', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Pizza',
      'Ramen', 'Sandwiches', 'Seafood', 'Smoothies', 'Soul food', 'Southern', 'Spanish', 'Steak', 'Sushi', 'Tacos', 'Thai',
      'Vegan', 'Vegetarian', 'Vietnamese', 'Wine bar',
    ],
  },
  {
    id: 'retail',
    label: 'Retail',
    categoryIds: [5],
    keywords: [
      'Apparel', 'Art supplies', 'Books', 'Boutique', 'Children\'s clothing', 'Convenience store', 'Crafts', 'Electronics',
      'Fashion', 'Flowers', 'Furniture', 'Gifts', 'Grocery', 'Home decor', 'Jewelry', 'Liquor store', 'Local goods', 'Menswear',
      'Pet supplies', 'Pharmacy', 'Shoes', 'Sporting goods', 'Stationery', 'Thrift', 'Toys', 'Vintage', 'Womenswear',
    ],
  },
  {
    id: 'health-beauty',
    label: 'Health & beauty',
    categoryIds: [2],
    keywords: [
      'Acupuncture', 'Barber', 'Beauty salon', 'Chiropractic', 'Cosmetics', 'Day spa', 'Dental', 'Fitness', 'Hair salon',
      'Lashes', 'Massage', 'Med spa', 'Mental wellness', 'Nail salon', 'Nutrition', 'Personal training', 'Physical therapy',
      'Pilates', 'Skincare', 'Tattoo', 'Wellness', 'Yoga',
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    categoryIds: [3],
    keywords: [
      'Arcade', 'Art gallery', 'Bowling', 'Cinema', 'Comedy', 'Concerts', 'Dance', 'Escape room', 'Family fun', 'Gaming',
      'Kids activities', 'Live music', 'Mini golf', 'Museum', 'Paint night', 'Performing arts', 'Sports venue', 'Theater',
      'Tours', 'Trivia', 'Virtual reality',
    ],
  },
  {
    id: 'home-services',
    label: 'Home services',
    categoryIds: [4],
    keywords: [
      'Appliance repair', 'Car wash', 'Cleaning', 'Electrician', 'Flooring', 'Gardening', 'Handyman', 'Heating and cooling',
      'Home improvement', 'Landscaping', 'Locksmith', 'Moving', 'Painting', 'Pest control', 'Plumbing', 'Pressure washing',
      'Roofing', 'Security systems', 'Solar', 'Towing', 'Window cleaning',
    ],
  },
  {
    id: 'general',
    label: 'General',
    categoryIds: [1, 2, 3, 4, 5, 6],
    keywords: [
      'Appointments', 'Delivery', 'Family-owned', 'Gift cards', 'Locally owned', 'Memberships', 'Mobile service', 'Online booking',
      'Outdoor seating', 'Pet friendly', 'Pickup', 'Reservations', 'Same-day service', 'Senior friendly', 'Student friendly',
      'Veteran owned', 'Women owned',
    ],
  },
]

export function getBusinessCategoryById(value: unknown) {
  const id = typeof value === 'number' ? value : Number(value)
  return BUSINESS_CATEGORIES.find((category) => category.id === id) || null
}

export function getBusinessCategoryId(value: string | number | null | undefined): BusinessCategoryId | null {
  const direct = getBusinessCategoryById(value)
  if (direct) return direct.id

  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null

  const aliases: Record<string, BusinessCategoryId> = {
    'food & beverage': 1,
    food: 1,
    restaurant: 1,
    coffee: 1,
    'coffee & tea': 1,
    'health & beauty': 2,
    'health & wellness': 2,
    'beauty & spa': 2,
    beauty: 2,
    entertainment: 3,
    'home services': 4,
    service: 4,
    retail: 5,
    'retail store': 5,
    other: 6,
  }

  return aliases[normalized] || null
}

export function getBusinessCategoryLabel(value: string | number | null | undefined) {
  const id = getBusinessCategoryId(value)
  return id ? getBusinessCategoryById(id)?.label || null : null
}

export function getKeywordGroupsForCategory(categoryId: string | number | null | undefined) {
  const id = getBusinessCategoryId(categoryId)
  if (!id) return BUSINESS_KEYWORD_GROUPS
  return BUSINESS_KEYWORD_GROUPS.filter((group) => group.categoryIds.includes(id))
}
