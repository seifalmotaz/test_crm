export const categories = ['All', 'Deal', 'Lead', 'Property', 'Client', 'Admin']
export const priorities = ['all', 'critical', 'high', 'medium', 'low']
export const statuses = ['all', 'overdue', 'in_progress', 'not_started', 'completed']

export const workflowTemplates = [
  {
    id: 'deal_offer_to_close',
    name: 'Deal: Offer to Close',
    category: 'Deal',
    tasks: 6,
    description: 'Full 6-week deal workflow from offer to closing day',
    steps: ['Submit Offer', 'Schedule Inspection', 'Order Appraisal', 'Financing Confirmation', 'Prepare Docs', 'Closing Day'],
  },
  {
    id: 'lead_qualification',
    name: 'Lead: Qualification',
    category: 'Lead',
    tasks: 4,
    description: 'Day 1–30 lead qualification and showing workflow',
    steps: ['Day 1 Call', 'Day 3 Follow-up', 'Day 7 Property Recs', 'Day 14 Showing'],
  },
  {
    id: 'property_new_listing',
    name: 'Property: New Listing',
    category: 'Property',
    tasks: 5,
    description: 'Photography, listing copy, portal upload, weekly review',
    steps: ['Photos', 'Description', 'Portal Upload', 'Week 1 Review', 'Price Review'],
  },
  {
    id: 'client_post_close',
    name: 'Client: Post-Close',
    category: 'Client',
    tasks: 4,
    description: 'Month 1, 6, 12, 24 post-close relationship nurture',
    steps: ['Month 1 Call', 'Month 6 Update', 'Month 12 Review', 'Month 24 Next Move'],
  },
]
