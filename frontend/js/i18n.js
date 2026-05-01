/* SalesFAST 7 — i18n (TH/EN) */

const LANG = {
th: {
  // Nav menus
  nav_dashboard:'แดชบอร์ด', nav_crm:'CRM', nav_sales:'การขาย', nav_activities:'กิจกรรม', nav_documents:'เอกสาร', nav_settings:'ตั้งค่า',
  nav_accounts:'บัญชีลูกค้า', nav_contacts:'ผู้ติดต่อ', nav_leads:'ลีด', nav_opportunities:'โอกาสขาย',
  nav_pipeline:'ไปป์ไลน์', nav_pipeline_desc:'จัดการลีดและดีล',
  nav_tasks:'งาน', nav_calendar:'ปฏิทิน', nav_quotations:'ใบเสนอราคา', nav_products:'สินค้า',
  nav_notifications:'แจ้งเตือน', nav_settings_page:'ตั้งค่า',
  nav_accounts_desc:'จัดการบัญชีลูกค้า', nav_contacts_desc:'รายชื่อผู้ติดต่อ',
  nav_leads_desc:'ไปป์ไลน์ลีด', nav_opportunities_desc:'จัดการดีล',
  nav_tasks_desc:'จัดการงาน', nav_calendar_desc:'ตารางนัดหมาย',
  nav_quotations_desc:'ใบเสนอราคา', nav_products_desc:'แคตตาล็อกสินค้า',
  nav_notifications_desc:'การแจ้งเตือน', nav_settings_desc:'ตั้งค่าระบบ',
  nav_kpi_desc:'ภาพรวมและ KPI',

  // Dashboard
  dash_title:'ภาพรวม', dash_sub:'แดชบอร์ดสรุปข้อมูลการขาย — อัปเดตวันนี้',
  dash_month:'เดือน', dash_quarter:'ไตรมาส', dash_year:'ปี',
  kpi_closed:'รายได้ปิดการขาย', kpi_target:'ความคืบหน้าเป้าหมาย', kpi_leads:'ลีดใหม่', kpi_conv:'อัตราการแปลง',
  kpi_of_target:'จากเป้า', kpi_benchmark:'Benchmark: 22%',
  pipe_by_stage:'มูลค่าตามขั้นตอน', pipe_weighted:'ดีลและมูลค่าถ่วงน้ำหนัก',
  pipe_deals:'ดีล',
  funnel_title:'อัตราการแปลงลีด',
  reps_title:'ผลงานทีมขาย', reps_deals:'ดีล', reps_acts:'กิจกรรม',

  // Accounts
  acc_title:'บัญชีลูกค้า', acc_sub:'จัดการบัญชีลูกค้าทั้งหมด', acc_records:'รายการ',
  acc_new:'+ สร้างบัญชี', acc_search:'ค้นหาชื่อบริษัท, เลขภาษี, อุตสาหกรรม...',
  acc_company:'ชื่อบริษัท', acc_taxid:'เลขผู้เสียภาษี', acc_industry:'อุตสาหกรรม',
  acc_phone:'โทรศัพท์', acc_status:'สถานะ', acc_tier:'ระดับ', acc_revenue:'รายได้',
  acc_none:'ไม่พบบัญชีลูกค้า',
  // Account form
  acc_form_title:'สร้างบัญชีใหม่', acc_form_company:'ข้อมูลบริษัท', acc_form_tax:'ภาษีและจดทะเบียน',
  acc_form_contact:'ข้อมูลติดต่อ', acc_form_address:'ที่อยู่จดทะเบียน', acc_form_sales:'ข้อมูลการขาย', acc_form_notes:'หมายเหตุภายใน',
  acc_name_th:'ชื่อบริษัท (ไทย)', acc_name_en:'ชื่อบริษัท (อังกฤษ)', acc_type:'ประเภทบริษัท',
  acc_desc:'รายละเอียดธุรกิจ', acc_tax_label:'เลขผู้เสียภาษี (13 หลัก)',
  acc_branch:'รหัสสาขา', acc_branch_name:'ชื่อสาขา', acc_capital:'ทุนจดทะเบียน (บาท)',
  acc_reg_date:'วันจดทะเบียน', acc_reg_no:'เลขทะเบียนนิติบุคคล',
  acc_phone2:'โทรศัพท์ 2', acc_fax:'แฟกซ์', acc_email:'อีเมล', acc_website:'เว็บไซต์', acc_line:'LINE OA ID',
  acc_addr:'ที่อยู่', acc_subdistrict:'ตำบล/แขวง', acc_district:'อำเภอ/เขต', acc_province:'จังหวัด', acc_zip:'รหัสไปรษณีย์',
  acc_source:'แหล่งที่มา', acc_credit_term:'เครดิตเทอม (วัน)', acc_credit_limit:'วงเงินเครดิต (บาท)', acc_payment:'วิธีชำระเงิน',

  // Tasks
  task_title:'งานและกิจกรรม', task_sub:'จัดการงาน นัดหมาย และบันทึกการโทร',
  task_new:'+ สร้างงาน', task_call:'บันทึกการโทร', task_calendar:'ปฏิทิน',
  task_all:'ทั้งหมด', task_open:'เปิด', task_progress:'กำลังดำเนินการ', task_done:'เสร็จสิ้น', task_overdue:'เกินกำหนด',
  task_col_name:'ชื่องาน', task_col_due:'วันครบกำหนด', task_col_priority:'ความสำคัญ', task_col_status:'สถานะ', task_col_account:'บัญชี',
  task_none:'ไม่พบงาน',
  task_form_title:'สร้างงานใหม่', task_form_details:'รายละเอียดงาน', task_form_link:'เชื่อมโยง',
  task_f_title:'ชื่องาน', task_f_desc:'รายละเอียด', task_f_due:'วันครบกำหนด', task_f_priority:'ความสำคัญ', task_f_status:'สถานะ',
  task_f_account:'บัญชีลูกค้า', task_f_assigned:'มอบหมายให้',
  call_form_title:'บันทึกการโทร', call_form_details:'รายละเอียดการโทร',
  call_f_duration:'ระยะเวลา (นาที)', call_f_outcome:'ผลการโทร', call_f_contact:'ผู้ที่โทรหา', call_f_notes:'บันทึก',
  call_connected:'ติดต่อได้', call_no_answer:'ไม่รับสาย', call_left_msg:'ฝากข้อความ', call_busy:'สายไม่ว่าง', call_wrong:'หมายเลขผิด',

  // Common
  btn_save:'บันทึก', btn_cancel:'ยกเลิก', btn_back:'กลับ', btn_edit:'แก้ไข',
  select_none:'-- ไม่ระบุ --', select_choose:'-- เลือก --',
  high:'สูง', medium:'กลาง', low:'ต่ำ',

  // Calendar
  cal_title:'ปฏิทิน', cal_subtitle:'ดูงาน นัดหมาย และการประชุม',
  cal_today:'วันนี้', cal_create:'+ สร้างงาน', cal_task_list:'รายการงาน',

  // Products
  prod_title:'แคตตาล็อกสินค้า', prod_subtitle:'จัดการสินค้าและบริการ',
  prod_new:'+ เพิ่มสินค้า', prod_search:'ค้นหาสินค้า / SKU...',
  prod_name:'ชื่อสินค้า', prod_sku:'SKU', prod_price:'ราคาต่อหน่วย',
  prod_unit:'หน่วย', prod_wht:'WHT %', prod_status:'สถานะ', prod_manage:'จัดการ',
  prod_active:'ใช้งาน', prod_inactive:'ปิดใช้งาน',
  prod_form_title:'เพิ่มสินค้าใหม่', prod_form_edit:'แก้ไขสินค้า',
  prod_form_desc:'กรอกข้อมูลสินค้าหรือบริการ',

  // User menu
  user_edit:'แก้ไขโปรไฟล์', user_password:'เปลี่ยนรหัสผ่าน', user_logout:'ออกจากระบบ',
  profile_title:'แก้ไขโปรไฟล์', pw_title:'เปลี่ยนรหัสผ่าน',
  pf_first:'ชื่อ', pf_last:'นามสกุล', pf_username:'ชื่อผู้ใช้', pf_email:'อีเมล', pf_role:'บทบาท',
  pf_phone:'เบอร์โทร', pf_birthday:'วันเกิด', pf_address:'ที่อยู่',
  pw_current:'รหัสผ่านปัจจุบัน', pw_new:'รหัสผ่านใหม่', pw_confirm:'ยืนยันรหัสผ่านใหม่', pw_update:'อัปเดตรหัสผ่าน',
},
en: {
  nav_dashboard:'Dashboard', nav_crm:'CRM', nav_sales:'Sales', nav_activities:'Activities', nav_documents:'Documents', nav_settings:'Settings',
  nav_accounts:'Accounts', nav_contacts:'Contacts', nav_leads:'Leads', nav_opportunities:'Opportunities',
  nav_pipeline:'Pipeline', nav_pipeline_desc:'Manage leads and deals',
  nav_tasks:'Tasks', nav_calendar:'Calendar', nav_quotations:'Quotations', nav_products:'Products',
  nav_notifications:'Notifications', nav_settings_page:'Settings',
  nav_accounts_desc:'Customer accounts', nav_contacts_desc:'Contact people',
  nav_leads_desc:'Lead pipeline', nav_opportunities_desc:'Deal management',
  nav_tasks_desc:'Task management', nav_calendar_desc:'Schedule & events',
  nav_quotations_desc:'Proposals & quotes', nav_products_desc:'Product catalog',
  nav_notifications_desc:'Alerts & messages', nav_settings_desc:'System config',
  nav_kpi_desc:'KPI & Overview',

  dash_title:'Dashboard', dash_sub:'Sales overview — Updated today',
  dash_month:'Month', dash_quarter:'Quarter', dash_year:'Year',
  kpi_closed:'Closed Revenue', kpi_target:'Target Progress', kpi_leads:'New Leads', kpi_conv:'Conversion Rate',
  kpi_of_target:'of target', kpi_benchmark:'Benchmark: 22%',
  pipe_by_stage:'Pipeline by Stage', pipe_weighted:'Deals & Weighted Value',
  pipe_deals:'deals',
  funnel_title:'Lead Conversion Funnel',
  reps_title:'Sales Team Performance', reps_deals:'deals', reps_acts:'activities',

  acc_title:'Accounts', acc_sub:'Manage all customer accounts', acc_records:'records',
  acc_new:'+ New Account', acc_search:'Search company name, tax ID, industry...',
  acc_company:'Company', acc_taxid:'Tax ID', acc_industry:'Industry',
  acc_phone:'Phone', acc_status:'Status', acc_tier:'Tier', acc_revenue:'Revenue',
  acc_none:'No accounts found',
  acc_form_title:'New Account', acc_form_company:'Company Information', acc_form_tax:'Tax & Registration',
  acc_form_contact:'Contact Information', acc_form_address:'Registered Address', acc_form_sales:'Sales Information', acc_form_notes:'Internal Notes',
  acc_name_th:'Company Name (TH)', acc_name_en:'Company Name (EN)', acc_type:'Company Type',
  acc_desc:'Business Description', acc_tax_label:'Tax ID (13 digits)',
  acc_branch:'Branch Code', acc_branch_name:'Branch Name', acc_capital:'Registered Capital (THB)',
  acc_reg_date:'Registration Date', acc_reg_no:'Registration No.',
  acc_phone2:'Phone 2', acc_fax:'Fax', acc_email:'Email', acc_website:'Website', acc_line:'LINE OA ID',
  acc_addr:'Address', acc_subdistrict:'Sub-district', acc_district:'District', acc_province:'Province', acc_zip:'Postal Code',
  acc_source:'Account Source', acc_credit_term:'Credit Term (days)', acc_credit_limit:'Credit Limit (THB)', acc_payment:'Payment Method',

  task_title:'Tasks & Activities', task_sub:'Manage tasks, appointments and call logs',
  task_new:'+ New Task', task_call:'Log Call', task_calendar:'Calendar',
  task_all:'All', task_open:'Open', task_progress:'In Progress', task_done:'Completed', task_overdue:'Overdue',
  task_col_name:'Task', task_col_due:'Due Date', task_col_priority:'Priority', task_col_status:'Status', task_col_account:'Account',
  task_none:'No tasks found',
  task_form_title:'New Task', task_form_details:'Task Details', task_form_link:'Link to',
  task_f_title:'Title', task_f_desc:'Description', task_f_due:'Due Date', task_f_priority:'Priority', task_f_status:'Status',
  task_f_account:'Account', task_f_assigned:'Assigned To',
  call_form_title:'Log Call', call_form_details:'Call Details',
  call_f_duration:'Duration (minutes)', call_f_outcome:'Outcome', call_f_contact:'Contact Person', call_f_notes:'Notes',
  call_connected:'Connected', call_no_answer:'No Answer', call_left_msg:'Left Message', call_busy:'Busy', call_wrong:'Wrong Number',

  btn_save:'Save', btn_cancel:'Cancel', btn_back:'Back', btn_edit:'Edit',
  select_none:'-- None --', select_choose:'-- Select --',
  high:'High', medium:'Medium', low:'Low',

  // Calendar
  cal_title:'Calendar', cal_subtitle:'View tasks, appointments and meetings',
  cal_today:'Today', cal_create:'+ New Task', cal_task_list:'Task List',

  // Products
  prod_title:'Product Catalog', prod_subtitle:'Manage products and services',
  prod_new:'+ Add Product', prod_search:'Search product / SKU...',
  prod_name:'Product Name', prod_sku:'SKU', prod_price:'Unit Price',
  prod_unit:'Unit', prod_wht:'WHT %', prod_status:'Status', prod_manage:'Manage',
  prod_active:'Active', prod_inactive:'Inactive',
  prod_form_title:'Add New Product', prod_form_edit:'Edit Product',
  prod_form_desc:'Enter product or service details',

  user_edit:'Edit Profile', user_password:'Change Password', user_logout:'Log out',
  profile_title:'Edit Profile', pw_title:'Change Password',
  pf_first:'First Name', pf_last:'Last Name', pf_username:'Username', pf_email:'Email', pf_role:'Role',
  pf_phone:'Phone', pf_birthday:'Birthday', pf_address:'Address',
  pw_current:'Current Password', pw_new:'New Password', pw_confirm:'Confirm New Password', pw_update:'Update Password',
}
};

function getLang() { return localStorage.getItem('sf7-lang') || 'en'; }
function setLang(lang) {
  localStorage.setItem('sf7-lang', lang);
  location.reload();
}
function t(key) { return LANG[getLang()][key] || LANG['en'][key] || key; }

/* Apply translations to all elements with data-i18n attribute */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val) el.placeholder = val;
  });
}
document.addEventListener('DOMContentLoaded', () => applyI18n());
