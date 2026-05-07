import React from 'react';
import { AboutModal } from '@ohif/ui-next';

function AboutModalDefault() {
  return (
    <AboutModal className="w-[400px]">
      <AboutModal.ProductName>上海迅影</AboutModal.ProductName>
      <AboutModal.ProductVersion>web-dicom</AboutModal.ProductVersion>
      <AboutModal.ProductBeta>1.0.0</AboutModal.ProductBeta>

      <AboutModal.Body>
        <a
          href="https://xunyingmed.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary py-4 text-lg hover:underline"
        >
          https://xunyingmed.cn
        </a>
      </AboutModal.Body>
    </AboutModal>
  );
}

const XunyingAboutModal = Object.assign(AboutModalDefault, {
  title: '关于',
  menuTitle: '关于',
  containerClassName: 'max-w-md',
});

export default {
  'ohif.aboutModal': XunyingAboutModal,
};
