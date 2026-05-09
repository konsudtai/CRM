-- ══════════════════════════════════════════════════════════════
-- SalesFAST 7 — Mock Data (IT Equipment & Solutions)
-- 10 Sales Reps, 100 Customers, 200 Leads, 50 Products
-- Period: 6 months (Nov 2025 - May 2026)
-- ══════════════════════════════════════════════════════════════

-- Tenant ID
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001') THEN INSERT INTO tenants(id, name, slug) VALUES('00000000-0000-0000-0000-000000000001','Com7 IT Solutions','com7'); END IF; END $$;

-- ══════════════════════════════════════════════════════════════
-- 10 Sales Reps
-- ══════════════════════════════════════════════════════════════
INSERT INTO users(id, tenant_id, email, password_hash, first_name, last_name, phone, is_active) VALUES
('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','somchai@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','สมชาย','วงศ์ดี','081-234-5001',true),
('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','siriporn@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','ศิริพร','แสงทอง','081-234-5002',true),
('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','wichai@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','วิชัย','สุขสม','081-234-5003',true),
('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','nattaya@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','ณัฐยา','พิมพ์ดี','081-234-5004',true),
('a0000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','prasit@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','ประสิทธิ์','เจริญผล','081-234-5005',true),
('a0000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','kannika@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','กรรณิการ์','ใจดี','081-234-5006',true),
('a0000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','thanawat@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','ธนวัฒน์','รุ่งเรือง','081-234-5007',true),
('a0000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','pimchan@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','พิมพ์ชนก','ศรีสุข','081-234-5008',true),
('a0000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','arun@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','อรุณ','มั่นคง','081-234-5009',true),
('a0000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','jirapat@com7.co.th','$2b$12$LJ3a5M5v5v5v5v5v5v5v5uX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5','จิรภัทร','ทองคำ','081-234-5010',true)
ON CONFLICT (id) DO NOTHING;

-- Assign Sales Rep role
INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE u.id IN ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000010')
AND r.name = 'Sales Rep' AND r.tenant_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 50 Products (IT Equipment & Solutions)
-- ══════════════════════════════════════════════════════════════
INSERT INTO products(tenant_id, name, sku, description, unit_price, unit_of_measure, is_active) VALUES
('00000000-0000-0000-0000-000000000001','Notebook Dell Latitude 5540','NB-DELL-5540','Intel i7, 16GB RAM, 512GB SSD, 15.6" FHD',42900,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Notebook Lenovo ThinkPad T14','NB-LNV-T14','AMD Ryzen 7, 16GB RAM, 512GB SSD, 14" FHD',38500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Notebook HP ProBook 450 G10','NB-HP-450G10','Intel i5, 8GB RAM, 256GB SSD, 15.6" FHD',28900,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Desktop Dell OptiPlex 7010','DT-DELL-7010','Intel i7, 16GB RAM, 512GB SSD, Win 11 Pro',32500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Desktop Lenovo ThinkCentre M70q','DT-LNV-M70Q','Intel i5, 8GB RAM, 256GB SSD, Tiny Form',22900,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Monitor Dell U2723QE','MN-DELL-U27','27" 4K USB-C Hub Monitor, IPS',18900,'จอ',true),
('00000000-0000-0000-0000-000000000001','Monitor LG 27UK850-W','MN-LG-27UK','27" 4K UHD, HDR, USB-C',15500,'จอ',true),
('00000000-0000-0000-0000-000000000001','Monitor Samsung S24A400','MN-SAM-24A','24" FHD IPS, USB-C, Built-in Webcam',8900,'จอ',true),
('00000000-0000-0000-0000-000000000001','Server Dell PowerEdge R750','SV-DELL-R750','2x Xeon Gold, 64GB RAM, 2x 960GB SSD RAID',285000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Server HPE ProLiant DL380 Gen10','SV-HPE-DL380','Xeon Silver, 32GB RAM, 2x 480GB SSD',195000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','NAS Synology DS1621+','NAS-SYN-1621','6-Bay NAS, AMD Ryzen, 4GB RAM',28500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','NAS QNAP TS-464','NAS-QNAP-464','4-Bay NAS, Intel N5095, 8GB RAM',19500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','UPS APC Smart-UPS 3000VA','UPS-APC-3000','3000VA/2700W, LCD, Rack Mount 2U',35000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','UPS CyberPower OLS1500E','UPS-CP-1500','1500VA/1350W, Online, Tower',12500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Switch Cisco Catalyst 9200L-24P','SW-CISCO-9200','24-Port PoE+, 4x 1G SFP, Layer 3',89000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Switch Aruba 2530-24G-PoE+','SW-ARUBA-2530','24-Port PoE+, 4x SFP, Layer 2',42000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Switch TP-Link TL-SG3428XMP','SW-TPL-3428','24-Port PoE+, 4x 10G SFP+, L2+',18500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Access Point Cisco Meraki MR46','AP-MERAKI-46','Wi-Fi 6, 4x4 MU-MIMO, Cloud Managed',28000,'ตัว',true),
('00000000-0000-0000-0000-000000000001','Access Point Aruba AP-535','AP-ARUBA-535','Wi-Fi 6, 8x8 MU-MIMO, Indoor',22000,'ตัว',true),
('00000000-0000-0000-0000-000000000001','Access Point UniFi U6-Pro','AP-UNIFI-U6P','Wi-Fi 6, 5.3 Gbps, PoE+',6500,'ตัว',true),
('00000000-0000-0000-0000-000000000001','Firewall Fortinet FortiGate 60F','FW-FG-60F','NGFW, 10 Gbps, SD-WAN, UTM',45000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Firewall Palo Alto PA-440','FW-PA-440','NGFW, 3.1 Gbps, Threat Prevention',85000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Firewall Sophos XGS 2100','FW-SOPHOS-2100','NGFW, 8.5 Gbps, Xstream Architecture',62000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Printer HP LaserJet Pro M404dn','PR-HP-M404','Mono Laser, Duplex, Network, 40ppm',12500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Printer Canon imageCLASS MF645Cx','PR-CANON-645','Color Laser MFP, Duplex, Wi-Fi',18900,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Printer Epson L6290','PR-EPSON-6290','Ink Tank, Color MFP, ADF, Wi-Fi, Fax',9900,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','SSD Samsung 990 Pro 2TB','SSD-SAM-990-2T','NVMe M.2, 7450/6900 MB/s',7500,'ชิ้น',true),
('00000000-0000-0000-0000-000000000001','SSD WD Black SN850X 1TB','SSD-WD-850X-1T','NVMe M.2, 7300/6300 MB/s',4200,'ชิ้น',true),
('00000000-0000-0000-0000-000000000001','HDD Seagate Exos X18 16TB','HDD-SEA-X18-16','Enterprise 3.5", 7200rpm, 256MB Cache',15500,'ชิ้น',true),
('00000000-0000-0000-0000-000000000001','RAM Kingston Fury 32GB DDR5','RAM-KNG-32D5','DDR5-5600, CL36, Desktop',3900,'แถว',true),
('00000000-0000-0000-0000-000000000001','RAM Crucial 16GB DDR4','RAM-CRU-16D4','DDR4-3200, CL22, SO-DIMM Laptop',1800,'แถว',true),
('00000000-0000-0000-0000-000000000001','Microsoft 365 Business Premium','LIC-M365-BP','Per user/month, Teams+Office+Security',650,'user/เดือน',true),
('00000000-0000-0000-0000-000000000001','Microsoft 365 Business Basic','LIC-M365-BB','Per user/month, Teams+OneDrive+Exchange',250,'user/เดือน',true),
('00000000-0000-0000-0000-000000000001','Adobe Creative Cloud','LIC-ADOBE-CC','All Apps, Per user/year',19900,'user/ปี',true),
('00000000-0000-0000-0000-000000000001','Veeam Backup & Replication','LIC-VEEAM-BR','Per socket license, Enterprise Plus',85000,'socket',true),
('00000000-0000-0000-0000-000000000001','VMware vSphere Standard','LIC-VMWARE-VS','Per CPU license, 1 year support',125000,'CPU',true),
('00000000-0000-0000-0000-000000000001','Windows Server 2022 Standard','LIC-WIN-SV22','16-Core License Pack',32000,'license',true),
('00000000-0000-0000-0000-000000000001','Antivirus Kaspersky Endpoint','LIC-KAS-EP','Per device/year, 50-99 devices',850,'device/ปี',true),
('00000000-0000-0000-0000-000000000001','Antivirus Trend Micro Apex One','LIC-TREND-AO','Per device/year, 25-49 devices',1200,'device/ปี',true),
('00000000-0000-0000-0000-000000000001','Cable Cat6A UTP 305m','CBL-CAT6A-305','Commscope, 10Gbps, 23AWG',8500,'กล่อง',true),
('00000000-0000-0000-0000-000000000001','Patch Panel 24-Port Cat6','PP-24-CAT6','1U Rack Mount, Loaded',2800,'ชิ้น',true),
('00000000-0000-0000-0000-000000000001','Server Rack 42U','RACK-42U','600x1000mm, Perforated Door, Fan',18500,'ตู้',true),
('00000000-0000-0000-0000-000000000001','KVM Switch 8-Port','KVM-8P','8-Port USB/HDMI, Rack Mount',12500,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Webcam Logitech Brio 4K','WC-LOGI-BRIO','4K Ultra HD, HDR, Auto-focus',6900,'ตัว',true),
('00000000-0000-0000-0000-000000000001','Conference Cam Poly Studio','VC-POLY-STUDIO','4K, Auto-framing, USB Soundbar',45000,'ชุด',true),
('00000000-0000-0000-0000-000000000001','Projector Epson EB-992F','PJ-EPSON-992F','4000 Lumens, FHD, Wi-Fi, Miracast',32000,'เครื่อง',true),
('00000000-0000-0000-0000-000000000001','Interactive Display Samsung Flip 65"','ID-SAM-FLIP65','65" 4K Touch, Built-in PC, Wi-Fi',89000,'จอ',true),
('00000000-0000-0000-0000-000000000001','บริการติดตั้ง Network (ต่อจุด)','SVC-NET-INST','ติดตั้ง LAN Drop + ทดสอบ + Label',1500,'จุด',true),
('00000000-0000-0000-0000-000000000001','บริการ IT Support รายเดือน','SVC-IT-MONTHLY','Helpdesk + Onsite, 8x5, SLA 4hr',15000,'เดือน',true),
('00000000-0000-0000-0000-000000000001','บริการ Cloud Migration','SVC-CLOUD-MIG','Assessment + Migration + Testing',150000,'โปรเจค',true)
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 100 Customers (Accounts)
-- ══════════════════════════════════════════════════════════════
INSERT INTO accounts(tenant_id, company_name, account_status, account_tier, industry, phone, email, tax_id, total_revenue, account_owner, customer_code) VALUES
('00000000-0000-0000-0000-000000000001','บริษัท สยามเทค จำกัด','active','gold','Technology','02-111-0001','info@siamtech.co.th','0105500001001',2500000,'a0000000-0000-0000-0000-000000000001','CUS-0001'),
('00000000-0000-0000-0000-000000000001','บริษัท ไทยดิจิทัล จำกัด','active','silver','Technology','02-111-0002','contact@thaidigital.co.th','0105500002002',1800000,'a0000000-0000-0000-0000-000000000002','CUS-0002'),
('00000000-0000-0000-0000-000000000001','บริษัท กรุงเทพซอฟต์ จำกัด','active','gold','Software','02-111-0003','sales@bkksoft.co.th','0105500003003',3200000,'a0000000-0000-0000-0000-000000000003','CUS-0003'),
('00000000-0000-0000-0000-000000000001','บริษัท เอเชียเน็ตเวิร์ค จำกัด','active','platinum','Networking','02-111-0004','info@asianet.co.th','0105500004004',5500000,'a0000000-0000-0000-0000-000000000004','CUS-0004'),
('00000000-0000-0000-0000-000000000001','บริษัท สมาร์ทโซลูชั่น จำกัด','active','silver','Consulting','02-111-0005','hello@smartsol.co.th','0105500005005',1200000,'a0000000-0000-0000-0000-000000000005','CUS-0005'),
('00000000-0000-0000-0000-000000000001','โรงพยาบาล เมดิเทค','active','gold','Healthcare','02-222-0001','it@meditech-hospital.co.th','0105500006006',4200000,'a0000000-0000-0000-0000-000000000006','CUS-0006'),
('00000000-0000-0000-0000-000000000001','มหาวิทยาลัย เทคโนโลยีสยาม','active','silver','Education','02-222-0002','procurement@stu.ac.th','0105500007007',1500000,'a0000000-0000-0000-0000-000000000007','CUS-0007'),
('00000000-0000-0000-0000-000000000001','บริษัท โลจิสติกส์พลัส จำกัด','active','standard','Logistics','02-222-0003','it@logplus.co.th','0105500008008',800000,'a0000000-0000-0000-0000-000000000008','CUS-0008'),
('00000000-0000-0000-0000-000000000001','บริษัท ฟู้ดเทค อินดัสทรี จำกัด','active','gold','Manufacturing','02-222-0004','purchase@foodtech-ind.co.th','0105500009009',3800000,'a0000000-0000-0000-0000-000000000009','CUS-0009'),
('00000000-0000-0000-0000-000000000001','บริษัท รีเทลมาสเตอร์ จำกัด','active','silver','Retail','02-222-0005','it@retailmaster.co.th','0105500010010',1600000,'a0000000-0000-0000-0000-000000000010','CUS-0010'),
('00000000-0000-0000-0000-000000000001','บริษัท ไฟแนนซ์โปร จำกัด','active','platinum','Finance','02-333-0001','infra@finpro.co.th','0105500011011',6800000,'a0000000-0000-0000-0000-000000000001','CUS-0011'),
('00000000-0000-0000-0000-000000000001','บริษัท คอนสตรัคชั่นเทค จำกัด','active','standard','Construction','02-333-0002','it@constructech.co.th','0105500012012',950000,'a0000000-0000-0000-0000-000000000002','CUS-0012'),
('00000000-0000-0000-0000-000000000001','บริษัท ออโตเมชั่นเวิร์ค จำกัด','active','gold','Manufacturing','02-333-0003','eng@autowork.co.th','0105500013013',2900000,'a0000000-0000-0000-0000-000000000003','CUS-0013'),
('00000000-0000-0000-0000-000000000001','บริษัท มีเดียครีเอทีฟ จำกัด','active','standard','Media','02-333-0004','studio@mediacreative.co.th','0105500014014',750000,'a0000000-0000-0000-0000-000000000004','CUS-0014'),
('00000000-0000-0000-0000-000000000001','บริษัท เอ็นเนอร์จี กรีน จำกัด','active','silver','Energy','02-333-0005','it@energygreen.co.th','0105500015015',2100000,'a0000000-0000-0000-0000-000000000005','CUS-0015'),
('00000000-0000-0000-0000-000000000001','บริษัท ทราเวลเทค จำกัด','active','standard','Travel','02-444-0001','sys@traveltech.co.th','0105500016016',680000,'a0000000-0000-0000-0000-000000000006','CUS-0016'),
('00000000-0000-0000-0000-000000000001','บริษัท อินชัวร์เทค จำกัด','active','gold','Insurance','02-444-0002','infra@insuretech.co.th','0105500017017',3500000,'a0000000-0000-0000-0000-000000000007','CUS-0017'),
('00000000-0000-0000-0000-000000000001','บริษัท เอ็ดดูเคชั่นพลัส จำกัด','active','standard','Education','02-444-0003','purchase@eduplus.co.th','0105500018018',520000,'a0000000-0000-0000-0000-000000000008','CUS-0018'),
('00000000-0000-0000-0000-000000000001','บริษัท ฟาร์มาเทค จำกัด','active','silver','Pharmaceutical','02-444-0004','it@pharmatech.co.th','0105500019019',1900000,'a0000000-0000-0000-0000-000000000009','CUS-0019'),
('00000000-0000-0000-0000-000000000001','บริษัท พร็อพเพอร์ตี้เทค จำกัด','active','gold','Real Estate','02-444-0005','sys@proptech.co.th','0105500020020',4100000,'a0000000-0000-0000-0000-000000000010','CUS-0020'),
('00000000-0000-0000-0000-000000000001','บริษัท แบงค์กิ้งซิสเต็ม จำกัด','active','platinum','Banking','02-555-0001','it@banksys.co.th','0105500021021',8500000,'a0000000-0000-0000-0000-000000000001','CUS-0021'),
('00000000-0000-0000-0000-000000000001','บริษัท เฮลท์แคร์ไอที จำกัด','active','silver','Healthcare','02-555-0002','admin@healthit.co.th','0105500022022',1400000,'a0000000-0000-0000-0000-000000000002','CUS-0022'),
('00000000-0000-0000-0000-000000000001','บริษัท สมาร์ทฟาร์ม จำกัด','active','standard','Agriculture','02-555-0003','it@smartfarm.co.th','0105500023023',620000,'a0000000-0000-0000-0000-000000000003','CUS-0023'),
('00000000-0000-0000-0000-000000000001','บริษัท อีคอมเมิร์ซโปร จำกัด','active','gold','E-Commerce','02-555-0004','tech@ecompro.co.th','0105500024024',2800000,'a0000000-0000-0000-0000-000000000004','CUS-0024'),
('00000000-0000-0000-0000-000000000001','บริษัท โรโบติกส์แล็บ จำกัด','active','silver','Robotics','02-555-0005','eng@roboticslab.co.th','0105500025025',1700000,'a0000000-0000-0000-0000-000000000005','CUS-0025'),
('00000000-0000-0000-0000-000000000001','บริษัท ดาต้าเซ็นเตอร์ไทย จำกัด','active','platinum','Data Center','02-666-0001','sales@dcthai.co.th','0105500026026',12000000,'a0000000-0000-0000-0000-000000000006','CUS-0026'),
('00000000-0000-0000-0000-000000000001','บริษัท คลาวด์เฟิร์ส จำกัด','active','gold','Cloud','02-666-0002','biz@cloudfirst.co.th','0105500027027',3600000,'a0000000-0000-0000-0000-000000000007','CUS-0027'),
('00000000-0000-0000-0000-000000000001','บริษัท ไซเบอร์ซีเคียว จำกัด','active','silver','Cybersecurity','02-666-0003','info@cybersecure.co.th','0105500028028',2200000,'a0000000-0000-0000-0000-000000000008','CUS-0028'),
('00000000-0000-0000-0000-000000000001','บริษัท เพย์เมนท์เกตเวย์ จำกัด','active','gold','Fintech','02-666-0004','tech@paygate.co.th','0105500029029',4500000,'a0000000-0000-0000-0000-000000000009','CUS-0029'),
('00000000-0000-0000-0000-000000000001','บริษัท เกมมิ่งสตูดิโอ จำกัด','active','standard','Gaming','02-666-0005','dev@gamingstudio.co.th','0105500030030',890000,'a0000000-0000-0000-0000-000000000010','CUS-0030')
ON CONFLICT DO NOTHING;

-- Generate remaining 70 accounts (CUS-0031 to CUS-0100)
INSERT INTO accounts(tenant_id, company_name, account_status, account_tier, industry, phone, total_revenue, account_owner, customer_code)
SELECT '00000000-0000-0000-0000-000000000001',
  'บริษัท ' || (ARRAY['ไทย','สยาม','กรุงเทพ','เอเชีย','แปซิฟิก','โกลบอล','ยูนิ','เมโทร','ซิตี้','สตาร์'])[1 + (i % 10)] ||
  (ARRAY['เทค','ซอฟต์','เน็ต','คอม','ดิจิทัล','ไอที','ซิส','โปร','พลัส','เวิร์ค'])[1 + ((i/10) % 10)] || ' จำกัด',
  CASE WHEN i%5=0 THEN 'inactive' ELSE 'active' END,
  (ARRAY['standard','silver','gold','standard','silver'])[1 + (i % 5)],
  (ARRAY['Technology','Manufacturing','Retail','Finance','Healthcare','Education','Logistics','Construction','Media','Energy'])[1 + (i % 10)],
  '02-' || lpad((700+i)::text, 3, '0') || '-' || lpad((1000+i)::text, 4, '0'),
  (100000 + (random()*5000000)::int),
  ('a0000000-0000-0000-0000-0000000000' || lpad((1 + (i % 10))::text, 2, '0'))::uuid,
  'CUS-' || lpad((30 + i)::text, 4, '0')
FROM generate_series(1, 70) AS i
ON CONFLICT DO NOTHING;

-- Initialize customer_sequences to track the running number (100 customers inserted)
INSERT INTO customer_sequences(tenant_id, current_value)
VALUES ('00000000-0000-0000-0000-000000000001', 100)
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 200 Leads (spread across 6 months: Nov 2025 - May 2026)
-- Various statuses, values, sources, assigned to 10 reps
-- ══════════════════════════════════════════════════════════════
INSERT INTO leads(tenant_id, name, company_name, email, phone, status, source, assigned_to, metadata, created_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  (ARRAY['คุณสมชาย','คุณสมศรี','คุณวิชัย','คุณนภา','คุณธนา','คุณพิมพ์','คุณอรุณ','คุณกานต์','คุณเจษฎา','คุณรัตนา','คุณประสิทธิ์','คุณจันทร์','คุณสุรชัย','คุณนิตยา','คุณภาณุ','คุณดวงใจ','คุณอนุชา','คุณพรทิพย์','คุณวรพล','คุณศิริลักษณ์'])[1 + (i % 20)] || ' ' || (ARRAY['ก.','ข.','ค.','ง.','จ.','ฉ.','ช.','ซ.','ฌ.','ญ.'])[1 + (i % 10)] || i::text,
  (ARRAY['บ.สยามเทค','บ.ไทยดิจิทัล','บ.กรุงเทพซอฟต์','บ.เอเชียเน็ต','บ.สมาร์ทโซลูชั่น','รพ.เมดิเทค','ม.เทคโนโลยีสยาม','บ.โลจิสติกส์พลัส','บ.ฟู้ดเทค','บ.รีเทลมาสเตอร์','บ.ไฟแนนซ์โปร','บ.คอนสตรัคชั่นเทค','บ.ออโตเมชั่น','บ.มีเดียครีเอทีฟ','บ.เอ็นเนอร์จี กรีน','บ.ทราเวลเทค','บ.อินชัวร์เทค','บ.เอ็ดดูเคชั่นพลัส','บ.ฟาร์มาเทค','บ.พร็อพเพอร์ตี้เทค'])[1 + (i % 20)],
  'lead' || i || '@example.com',
  '08' || (1 + (i % 9))::text || '-' || lpad((1000000 + i*7)::text, 7, '0'),
  -- Status distribution: 30 New, 35 Contacted, 30 Qualified, 35 Proposal, 25 Negotiation, 30 Won, 15 Lost
  CASE
    WHEN i <= 30 THEN 'New'
    WHEN i <= 65 THEN 'Contacted'
    WHEN i <= 95 THEN 'Qualified'
    WHEN i <= 130 THEN 'Proposal'
    WHEN i <= 155 THEN 'Negotiation'
    WHEN i <= 185 THEN 'Won'
    ELSE 'Lost'
  END,
  (ARRAY['Website','Referral','Facebook','LINE','Event','Walk-in','Cold Call','Existing Customer'])[1 + (i % 8)],
  -- Assign to 10 reps (some New leads unassigned)
  CASE WHEN i <= 15 THEN NULL ELSE ('a0000000-0000-0000-0000-0000000000' || lpad((1 + (i % 10))::text, 2, '0'))::uuid END,
  -- Metadata with value, project, priority
  json_build_object(
    'estimatedValue', CASE
      WHEN i % 7 = 0 THEN (500000 + (random()*2000000)::int)  -- big deals
      WHEN i % 3 = 0 THEN (100000 + (random()*500000)::int)   -- medium
      ELSE (20000 + (random()*150000)::int)                     -- small
    END,
    'projectName', (ARRAY['ระบบ Network ใหม่','อัพเกรด Server','จัดซื้อ Notebook','ระบบ Security','License M365','ติดตั้ง Wi-Fi','ระบบ Backup','จัดซื้อ Monitor','IT Support รายเดือน','Cloud Migration','ระบบ UPS','จัดซื้อ Printer','ระบบ Conference','อัพเกรด Storage','ระบบ Firewall'])[1 + (i % 15)],
    'priority', (ARRAY['High','Medium','Medium','Low','High','Medium'])[1 + (i % 6)],
    'notes', 'Lead #' || i || ' - สนใจสินค้า IT'
  )::jsonb,
  -- Spread created_at across 6 months (Nov 2025 - May 2026)
  '2025-11-01'::timestamp + (i * interval '54 hours') + (random() * interval '24 hours')
FROM generate_series(1, 200) AS i
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- Some Tasks for Sales Reps
-- ══════════════════════════════════════════════════════════════
INSERT INTO tasks(tenant_id, title, status, priority, due_date, assigned_to)
SELECT
  '00000000-0000-0000-0000-000000000001',
  (ARRAY['โทรติดตาม Lead','ส่ง Quotation','นัด Demo','Follow-up หลัง Meeting','เตรียม Proposal','ส่งเอกสารสัญญา','ติดตั้งอุปกรณ์','ทดสอบระบบ','อบรมผู้ใช้งาน','ปิด Deal'])[1 + (i % 10)] || ' #' || i,
  CASE WHEN i%4=0 THEN 'Completed' WHEN i%7=0 THEN 'In Progress' ELSE 'Open' END,
  (ARRAY['High','Medium','Medium','Low'])[1 + (i % 4)],
  CURRENT_DATE + (i - 15) * interval '1 day',
  ('a0000000-0000-0000-0000-0000000000' || lpad((1 + (i % 10))::text, 2, '0'))::uuid
FROM generate_series(1, 30) AS i
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Mock data loaded: ' || 
  (SELECT count(*) FROM users WHERE tenant_id='00000000-0000-0000-0000-000000000001') || ' users, ' ||
  (SELECT count(*) FROM accounts WHERE tenant_id='00000000-0000-0000-0000-000000000001') || ' accounts, ' ||
  (SELECT count(*) FROM leads WHERE tenant_id='00000000-0000-0000-0000-000000000001') || ' leads, ' ||
  (SELECT count(*) FROM products WHERE tenant_id='00000000-0000-0000-0000-000000000001') || ' products, ' ||
  (SELECT count(*) FROM tasks WHERE tenant_id='00000000-0000-0000-0000-000000000001') || ' tasks'
AS result;
